"""
===============================================================================
 crawler.py  --  Hand-built HTTP/1.1 client over raw TCP sockets, plus a
                 breadth-first web crawler
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Aaditya Doshi (2024300053)
 CHECKPOINT   : 7  (raw socket GET over plain HTTP + response parsing by hand)
                8  (TLS wrapping with ssl + chunked Transfer-Encoding decoding)
                9  (breadth-first crawl queue + edges.txt writer)
 SRS MAPPING  : FR1.1, FR1.2, FR1.3, FR1.4, FR1.5, FR1.6, FR1.7, NFR6, NFR7
 DAD MAPPING  : Design of Algorithm document, Section 3 "BFS Crawling Algorithm"

 PURPOSE
 -------
 Get real web pages off the real internet and turn them into a link graph,
 without using requests, urllib, or any other HTTP convenience library. We open
 a TCP socket, type the HTTP request out by hand as bytes, and take apart the
 raw bytes that come back. The point is that nothing about HTTP stays a black
 box: the request line, the headers, the blank-line separator, the chunked body
 encoding and the TLS handshake are all visible in this file.

 WHAT AN HTTP/1.1 REQUEST ACTUALLY LOOKS LIKE ON THE WIRE
 -------------------------------------------------------
     GET /wiki/PageRank HTTP/1.1\\r\\n
     Host: en.wikipedia.org\\r\\n
     User-Agent: PageRankMiniProject/1.0\\r\\n
     Accept-Encoding: identity\\r\\n
     Connection: close\\r\\n
     \\r\\n                       <-- blank line ends the headers

 And the response:

     HTTP/1.1 200 OK\\r\\n
     Content-Type: text/html; charset=UTF-8\\r\\n
     Transfer-Encoding: chunked\\r\\n
     \\r\\n
     1f4\\r\\n<html>...500 bytes...\\r\\n     <-- chunk size in HEXADECIMAL
     0\\r\\n\\r\\n                              <-- zero-length chunk = end of body

 Every one of those pieces is parsed by hand below.

 BFS, NOT DFS
 ------------
 The crawl walks outwards level by level from the seed pages. Depth-first would
 chase one chain of links far away from the seeds and produce a long thin graph
 where almost every page has in-degree 1 -- there would be no authority signal
 for PageRank to find. Breadth-first collects the dense neighbourhood around the
 seeds, where pages genuinely link to each other, which is the graph PageRank
 was designed for.

 DEPENDENCIES
 ------------
 Standard library only: socket, ssl, re, time, os. Nothing from PyPI.
 Note that collections.deque is deliberately NOT used for the BFS queue -- see
 the comment inside crawl() for how we get O(1) dequeues from a plain list.

 HOW TO RUN
 ----------
     python crawler.py

 The __main__ block runs three demos: a plain-HTTP fetch (Checkpoint 7), an
 HTTPS fetch through TLS with chunked decoding (Checkpoint 8), and a small
 live breadth-first crawl that writes edges.txt (Checkpoint 9).

 Running the demo needs working internet access. Once edges.txt exists it is
 committed to the repository, so the ranking and search parts of the project
 keep working offline -- SRS NFR4. Checkpoint 11 adds an explicit cache mode.
===============================================================================
"""

import os
import re
import socket
import ssl
import time


# -----------------------------------------------------------------------------
# NETWORK CONSTANTS -- what each value is and why it was chosen
# -----------------------------------------------------------------------------

# The two well-known ports. We pass them explicitly rather than hard-coding one,
# because Checkpoint 7 demonstrates plain HTTP on 80 and Checkpoint 8 adds TLS
# on 443, and both code paths must stay runnable for the report.
HTTP_PORT = 80
HTTPS_PORT = 443

# Seconds to wait on any single socket operation before giving up. 10 is long
# enough that a slow-but-alive server still answers over college Wi-Fi, and
# short enough that one unreachable host cannot stall a 150-page crawl for
# minutes. Without this, a socket blocks forever and the crawl simply hangs.
SOCKET_TIMEOUT_SECONDS = 10.0

# How many bytes to ask the kernel for per recv() call. 4096 is one memory page,
# the usual default for socket buffers; larger values gain nothing here because
# the network, not the copy, is the bottleneck.
RECV_CHUNK_BYTES = 4096

# Refuse to buffer a response larger than this (about 2 MB). A normal Wikipedia
# article is 100-500 KB, so anything past this is either a mis-typed URL landing
# on a media file or a server misbehaving, and we would rather skip it than let
# one page eat all available memory during a 150-page crawl.
MAX_RESPONSE_BYTES = 2_000_000

# Seconds to pause between requests during a crawl. This is politeness, not
# performance: hitting a public site as fast as a loop can go looks like an
# attack, can get the college IP rate-limited or blocked mid-demo, and is
# exactly the behaviour SRS NFR7 tells us to avoid. 1.0 second is the delay
# Wikipedia's own crawling guidance treats as well-behaved for a small client.
CRAWL_DELAY_SECONDS = 1.0

# Sent as the User-Agent header. Wikipedia rejects requests from clients that do
# not identify themselves (they answer 403), so a descriptive string is required
# for the crawl to work at all, and it is also the honest thing to send.
USER_AGENT = "PageRankMiniProject/1.0 (SPIT TE Sem V mini project; educational crawl)"

# How many 3xx redirects to follow before giving up on one URL. Real sites
# redirect once (http -> https, or an old title -> its new title); a chain
# longer than 3 is almost always a redirect loop, and following it forever
# would hang the crawl.
MAX_REDIRECTS = 3

# The crawl target. Wikipedia is used because its internal links all share one
# predictable shape (href="/wiki/Title"), it is a genuine densely-linked web
# neighbourhood rather than a toy site, and it permits polite crawling.
WIKI_HOST = "en.wikipedia.org"
WIKI_PATH_PREFIX = "/wiki/"

# Default output file for the link graph, one "SOURCE<TAB>TARGET" pair per line.
EDGES_FILE = "edges.txt"


# =============================================================================
# CHECKPOINT 7 -- building the request and taking the response apart by hand
# =============================================================================

def build_http_get_request(host, path):
    """Construct a complete HTTP/1.1 GET request as raw bytes (FR1.2).

    Args:
        host: server name, e.g. "en.wikipedia.org". Goes in the Host header.
        path: absolute path on that server, e.g. "/wiki/PageRank".

    Returns:
        bytes, ready to hand straight to socket.sendall().
    """
    # Built as a list of lines and joined, rather than one long concatenation,
    # so that adding or removing a header later is a one-line change.
    lines = [
        # The request line. HTTP/1.1 (not 1.0) because we need the Host header,
        # and modern servers host many sites on one IP address.
        "GET {0} HTTP/1.1".format(path),

        # Mandatory in HTTP/1.1. Omitting it gets a 400 Bad Request.
        "Host: {0}".format(host),

        "User-Agent: {0}".format(USER_AGENT),

        # We can read HTML; we are not asking for images or JSON.
        "Accept: text/html",

        # CRITICAL: "identity" means "do not compress the body". Servers default
        # to gzip, and we have no decompression code (and zlib is outside the
        # library allowance we agreed for this project), so a gzipped body would
        # arrive as unreadable binary. Asking for identity keeps it plain text.
        "Accept-Encoding: identity",

        # Tell the server to close the connection once it has sent the response.
        # This is what lets receive_full_response() below simply read until the
        # socket goes quiet, instead of having to track Content-Length to know
        # where one response ends and the next begins on a kept-alive socket.
        "Connection: close",
    ]

    # \r\n (CRLF), not \n: the HTTP specification requires carriage-return plus
    # line-feed, and strict servers reject bare newlines. The trailing "\r\n\r\n"
    # is the blank line that marks the end of the headers.
    return ("\r\n".join(lines) + "\r\n\r\n").encode("ascii")


def open_connection(host, port, use_tls):
    """Open a TCP socket to host:port, optionally wrapped in TLS (FR1.1).

    Args:
        host:    server name to resolve and connect to.
        port:    TCP port, normally 80 for HTTP or 443 for HTTPS.
        use_tls: True to wrap the socket with SSL/TLS (Checkpoint 8).

    Returns:
        a connected socket object the caller must close.

    Raises:
        OSError (which covers socket.timeout, ConnectionError, socket.gaierror
        and ssl.SSLError) if the connection cannot be established.
    """
    # AF_INET = IPv4, SOCK_STREAM = TCP. This is the raw BSD socket API, the
    # same one every HTTP library sits on top of.
    raw_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    # Set the timeout BEFORE connect(), otherwise the connect itself can block
    # indefinitely on an unreachable host and the timeout never gets a chance
    # to apply.
    raw_socket.settimeout(SOCKET_TIMEOUT_SECONDS)

    if not use_tls:
        raw_socket.connect((host, port))
        return raw_socket

    # ---- Checkpoint 8: TLS -------------------------------------------------
    # Nearly every real site now answers plain HTTP with a 301 to https, so the
    # Checkpoint 7 version could not actually fetch an article. create_default_
    # context() gives us certificate verification and hostname checking switched
    # on by default, which is what makes this a real HTTPS client and not a
    # pretend one. We do not disable either check.
    context = ssl.create_default_context()

    # server_hostname is required for SNI: one IP address serves thousands of
    # sites, and this is how the server knows which certificate to present.
    # It is also the name the certificate is verified against.
    secure_socket = context.wrap_socket(raw_socket, server_hostname=host)
    secure_socket.connect((host, port))
    return secure_socket


def receive_full_response(connected_socket):
    """Read the entire response off the socket until the server closes it.

    Args:
        connected_socket: a socket that a request has already been sent on.

    Returns:
        bytes: headers and body exactly as they arrived, unparsed.

    Because the request sent "Connection: close", the server closes the
    connection when it is done. recv() returning b"" is the operating system
    telling us the other end hung up -- that, not a byte count, is our
    end-of-response signal.
    """
    received_parts = []
    total_bytes = 0

    while True:
        block = connected_socket.recv(RECV_CHUNK_BYTES)
        if not block:
            # Empty bytes means end of stream: the server closed the connection.
            break

        received_parts.append(block)
        total_bytes += len(block)

        if total_bytes > MAX_RESPONSE_BYTES:
            # Stop reading an unreasonably large page rather than exhausting
            # memory. The partial data is still returned; the chunked decoder
            # below is written to tolerate a body that stops mid-chunk.
            break

    # Accumulate into a list and join once. Repeatedly doing  data += block
    # would copy the whole buffer on every recv, turning a linear read into a
    # quadratic one on a large page.
    return b"".join(received_parts)


def parse_http_response(raw_response):
    """Split a raw HTTP response into status code, headers and body (FR1.3).

    Args:
        raw_response: bytes straight off the socket.

    Returns:
        (status_code, headers, body) where
            status_code : int, e.g. 200, or 0 if the response was unparseable
            headers     : dict of lowercase header name -> value string
            body        : bytes, still chunk-encoded if the server used chunking

    Header names are lowercased because HTTP header names are case-insensitive,
    and servers are inconsistent -- "Content-Type", "content-type" and
    "Content-type" all occur in the wild. Lowercasing once here means every
    caller can just look up headers["content-type"].
    """
    # The blank line between headers and body is CRLF CRLF. split with maxsplit=1
    # because the body itself may well contain that same byte sequence.
    header_block, separator, body = raw_response.partition(b"\r\n\r\n")

    if not separator:
        # No blank line at all: the response is malformed or was truncated
        # before the headers finished. Report it rather than crashing, so the
        # crawl can skip this page and continue (SRS NFR6).
        return 0, {}, b""

    # Headers are ASCII by specification; "replace" rather than a hard failure
    # because one badly-encoded header should not sink an otherwise good page.
    header_lines = header_block.decode("iso-8859-1", errors="replace").split("\r\n")

    # ---- status line, e.g. "HTTP/1.1 200 OK" -------------------------------
    status_code = 0
    status_parts = header_lines[0].split(" ", 2)
    if len(status_parts) >= 2 and status_parts[1].isdigit():
        status_code = int(status_parts[1])

    # ---- the remaining lines, each "Name: value" ---------------------------
    headers = {}
    for line in header_lines[1:]:
        name, colon, value = line.partition(":")
        if not colon:
            # A header line with no colon is either a continuation line or junk.
            # Skipping it is safer than guessing what it meant.
            continue
        headers[name.strip().lower()] = value.strip()

    return status_code, headers, body


# =============================================================================
# CHECKPOINT 8 -- chunked Transfer-Encoding
# =============================================================================

def decode_chunked_body(body):
    """Reassemble a body sent with Transfer-Encoding: chunked.

    Args:
        body: the raw body bytes, in the form
              <hex size>\\r\\n<that many bytes>\\r\\n ... 0\\r\\n\\r\\n

    Returns:
        bytes: the body with all the chunk framing removed.

    Why this is needed: a server that generates a page on the fly does not know
    the total length in advance, so it cannot send Content-Length. Instead it
    sends the body in pieces, each prefixed by its own length in HEXADECIMAL,
    and signals the end with a zero-length chunk. Wikipedia does exactly this,
    so without this function the fetched HTML comes out sprinkled with stray
    hex numbers and the link extractor silently produces garbage.

    The decoder is deliberately lenient: if the data runs out mid-chunk (because
    MAX_RESPONSE_BYTES cut the read short) it returns what it managed to decode
    instead of raising, since a partial page is still worth extracting links from.
    """
    decoded_parts = []
    position = 0

    while position < len(body):
        # Each chunk starts with its size on its own CRLF-terminated line.
        line_end = body.find(b"\r\n", position)
        if line_end == -1:
            break  # truncated: no complete size line left

        size_line = body[position:line_end]

        # A chunk size may carry optional ";extension" metadata after the number.
        # We never use extensions, so everything from the semicolon is dropped.
        size_text = size_line.split(b";")[0].strip()

        try:
            # base 16: chunk sizes are hexadecimal, not decimal. Reading "1f4"
            # as decimal would be one of the easier bugs to stare past.
            chunk_size = int(size_text, 16)
        except ValueError:
            break  # not a valid size line; stop rather than emit garbage

        if chunk_size == 0:
            break  # the zero-length chunk is the official end of the body

        chunk_start = line_end + 2               # skip past the CRLF
        chunk_end = chunk_start + chunk_size
        decoded_parts.append(body[chunk_start:chunk_end])

        # +2 again to step over the CRLF that terminates the chunk data itself.
        position = chunk_end + 2

    return b"".join(decoded_parts)


def split_url(url, default_host):
    """Break a URL into (host, port, path, use_tls) without urllib.

    Args:
        url:          absolute ("https://host/path") or root-relative ("/path").
        default_host: host to assume when the URL is root-relative, which is
                      what a Location header usually contains for a same-site
                      redirect.

    Returns:
        (host, port, path, use_tls)

    urllib.parse would do this in one line, but it is outside the standard
    library allowance we set for this project, and the parsing needed for the
    two URL shapes a crawl actually sees is about eight lines.
    """
    use_tls = True
    remainder = url

    if url.startswith("http://"):
        use_tls = False
        remainder = url[len("http://"):]
    elif url.startswith("https://"):
        remainder = url[len("https://"):]
    elif url.startswith("/"):
        # Root-relative: same server, so keep the host we are already talking to.
        return default_host, HTTPS_PORT, url, True

    # Everything up to the first "/" is the host; the rest is the path.
    slash_position = remainder.find("/")
    if slash_position == -1:
        host, path = remainder, "/"
    else:
        host, path = remainder[:slash_position], remainder[slash_position:]

    # An explicit port ("host:8080") overrides the scheme default.
    port = HTTPS_PORT if use_tls else HTTP_PORT
    if ":" in host:
        host_part, _, port_text = host.partition(":")
        if port_text.isdigit():
            host, port = host_part, int(port_text)

    return host, port, path, use_tls


def fetch(host, path, use_tls=True, port=None, redirects_left=MAX_REDIRECTS):
    """Fetch one page and return (status_code, headers, html_text).

    Args:
        host:           server to connect to.
        path:           path to request.
        use_tls:        True for HTTPS, False for plain HTTP.
        port:           override the default port; None picks 443 or 80.
        redirects_left: how many more 3xx hops we are willing to follow (FR1.6).

    Returns:
        (status_code, headers, html_text). html_text is a str; it is empty when
        the status is not 200.

    Raises:
        OSError on network failure. Callers inside the crawl loop catch this and
        skip the page, so that one dead link never ends the whole crawl (NFR6).
    """
    if port is None:
        port = HTTPS_PORT if use_tls else HTTP_PORT

    connected_socket = open_connection(host, port, use_tls)
    try:
        # sendall, not send: send() may transmit only part of the buffer and
        # return how much it wrote. sendall loops until everything is out.
        connected_socket.sendall(build_http_get_request(host, path))
        raw_response = receive_full_response(connected_socket)
    finally:
        # try/finally so the socket is released even if send or recv raises.
        # Leaked sockets accumulate over a 150-page crawl and eventually exhaust
        # the process's file-descriptor limit.
        connected_socket.close()

    status_code, headers, body = parse_http_response(raw_response)

    # ---- 3xx redirect (FR1.6) ---------------------------------------------
    if 300 <= status_code < 400 and "location" in headers and redirects_left > 0:
        new_host, new_port, new_path, new_tls = split_url(headers["location"], host)
        return fetch(new_host, new_path, new_tls, new_port, redirects_left - 1)

    if status_code != 200:
        # Anything else (404 missing page, 403 blocked, 5xx server error) is
        # returned to the caller to log and skip. We do not raise, because a
        # missing page is a normal event during a crawl, not an exception.
        return status_code, headers, ""

    # ---- un-chunk if needed (Checkpoint 8) ---------------------------------
    if headers.get("transfer-encoding", "").lower() == "chunked":
        body = decode_chunked_body(body)

    # errors="replace" so that one stray byte in a UTF-8 sequence -- which does
    # happen on real pages -- turns into a replacement character instead of
    # raising and losing the entire page.
    return status_code, headers, body.decode("utf-8", errors="replace")


# =============================================================================
# CHECKPOINT 9 -- link extraction and the breadth-first crawl
# =============================================================================

# Matches an article link and captures just the title.
#
# Two forms have to be accepted, because Wikipedia serves BOTH depending on
# which rendering pipeline answers the request:
#
#     href="/wiki/Larry_Page"                            (root-relative)
#     href="https://en.wikipedia.org/wiki/Larry_Page"    (absolute, Parsoid HTML)
#
# We hit exactly this in testing: a relative-only pattern found 44 links on the
# PageRank article while the page actually contained 455, because the bulk of
# them were written in the absolute form. The optional "(?:https?://...)?" group
# accepts either and captures the same title from both, so one article never
# becomes two different nodes in the graph.
#
# The capture group stops at the first quote, '#' (an in-page anchor) or '?' (a
# query string), because /wiki/Cat#History and /wiki/Cat are the same page.
#
# The host in the absolute form is pinned to WIKI_HOST rather than left as a
# wildcard. A wildcard also matched ar.wikipedia.org, ja.wikipedia.org and every
# other language edition in the sidebar, pulling ~15 percent-encoded translations
# of the SAME article into the graph as if they were separate pages. re.escape
# is used so the dots in the hostname stay literal dots.
WIKI_LINK_PATTERN = re.compile(
    r'href="(?:https?://' + re.escape(WIKI_HOST) + r')?/wiki/([^"#?]+)"')

# Wikipedia puts non-article pages in a namespace written as a "Prefix:" on the
# title -- Category:, File:, Help:, Special:, Talk:, Template:, Portal:,
# Wikipedia:. Those are site furniture, not content, and every article links to
# dozens of them, so including them would swamp the graph with pages nobody
# meaningfully "votes" for. A colon in the title is a reliable single test for
# all of them at once.
NAMESPACE_MARKER = ":"

# Main_Page is linked from the logo on literally every article, so it would
# accumulate a huge in-degree that says nothing about relevance. Excluded by name.
EXCLUDED_TITLES = {"Main_Page"}


def extract_wiki_links(html):
    """Extract the distinct article titles an HTML page links to (FR1.4).

    Args:
        html: the page source as a str.

    Returns:
        list of article titles, in the order they first appear on the page,
        with duplicates, namespace pages and Main_Page removed.

    A regular expression is used instead of a full HTML parser because we need
    exactly one attribute of one tag, all Wikipedia article links share one
    rigid shape, and html.parser is outside this project's library allowance.
    The trade-off is accepted knowingly: this would not be adequate for parsing
    arbitrary HTML.
    """
    links = []
    seen = set()

    for title in WIKI_LINK_PATTERN.findall(html):
        if NAMESPACE_MARKER in title:
            continue
        if title in EXCLUDED_TITLES:
            continue
        # Deduplicate: a link repeated in the body and the navigation box is
        # still one vote, and one edge in the graph.
        if title in seen:
            continue
        seen.add(title)
        links.append(title)

    return links


# <script> and <style> blocks are code and CSS, never reading text, so they are
# stripped whole -- tag, contents and all -- before the generic tag stripper runs.
SCRIPT_STYLE_PATTERN = re.compile(r"<(script|style)\b.*?</\1>", re.IGNORECASE | re.DOTALL)
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")
WHITESPACE_PATTERN = re.compile(r"\s+")

# The handful of HTML entities that actually show up in Wikipedia prose. The
# html module would handle all ~2000 of them, but it is outside our allowance
# and these five cover essentially everything that matters for word counting.
HTML_ENTITIES = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
    "&nbsp;": " ",
}


def extract_visible_text(html):
    """Strip HTML down to the readable words on the page.

    Args:
        html: page source as a str.

    Returns:
        str: the page text with tags, scripts and styles removed and all
        runs of whitespace collapsed to single spaces.

    This is not strictly required until search_engine.py needs something to
    index, but it belongs with the other HTML handling, and extracting it during
    the crawl means we never have to re-download a page just to read its words.
    """
    text = SCRIPT_STYLE_PATTERN.sub(" ", html)
    text = HTML_TAG_PATTERN.sub(" ", text)

    for entity, character in HTML_ENTITIES.items():
        text = text.replace(entity, character)

    # Collapse newlines, tabs and runs of spaces into one space. Tokenising in
    # search_engine.py splits on whitespace anyway, and a single-line string is
    # far easier to store in the one-record-per-line page_store format.
    return WHITESPACE_PATTERN.sub(" ", text).strip()


def crawl(seed_titles,
          max_pages,
          host=WIKI_HOST,
          delay_seconds=CRAWL_DELAY_SECONDS,
          verbose=True):
    """Breadth-first crawl from the seed pages, up to max_pages (FR1.5, FR1.7).

    Args:
        seed_titles:   list of article titles to start from, e.g. ["PageRank"].
        max_pages:     stop after this many pages have been fetched successfully.
        host:          site to crawl. Defaults to en.wikipedia.org.
        delay_seconds: pause between requests, for politeness (NFR7).
        verbose:       print one progress line per page (FR6.2).

    Returns:
        (edges, pages) where
            edges : list of (source_title, target_title) pairs, already filtered
                    so that both ends are pages we actually fetched
            pages : dict title -> visible text of that page

    Algorithm (see DAD Section 3.2):
        1. Put the seeds in a FIFO queue.
        2. Take the front title, fetch it, record its outgoing links.
        3. Push any title we have not queued before onto the back of the queue.
        4. Repeat until the queue empties or we hit max_pages.

    Known limitation, to be stated honestly in the report: titles are treated as
    identity, so a redirect alias ("Pagerank") and its target ("PageRank") can
    both end up as nodes if both are linked to. fetch() follows the redirect, so
    the two nodes hold identical text and split what should be one page's score.
    It affects a handful of pages in a 150-page crawl and could be fixed by
    keying on the final URL after redirects rather than the requested title.
    """
    # ---- the BFS queue ------------------------------------------------------
    # A plain list used as a FIFO, with an integer read head instead of pop(0).
    # pop(0) shifts every remaining element left, which is O(n) per dequeue and
    # turns the crawl loop quadratic once the queue grows to tens of thousands
    # of discovered titles. Advancing an index is O(1). collections.deque would
    # also solve this, but the project's declared standard-library allowance
    # covers only collections.Counter, and this costs one extra variable.
    queue = list(seed_titles)
    read_head = 0

    # Queued-or-fetched titles. Checked before enqueueing AND before fetching so
    # a page discovered from ten different sources is still only fetched once
    # (FR1.5). A set gives O(1) membership testing; a list would be O(n).
    seen_titles = set(seed_titles)

    edges = []
    pages = {}
    failure_count = 0

    while read_head < len(queue) and len(pages) < max_pages:
        title = queue[read_head]
        read_head += 1

        try:
            status_code, _headers, html = fetch(host, WIKI_PATH_PREFIX + title)
        except OSError as network_error:
            # Timeout, DNS failure, refused connection, TLS error. SRS NFR6 is
            # explicit that one bad page must not end the crawl, so we report it
            # and move on. (Checkpoint 10 tidies this handling into the report.)
            failure_count += 1
            if verbose:
                print("  [skip] {0}: {1}".format(title, network_error))
            continue

        if status_code != 200 or not html:
            failure_count += 1
            if verbose:
                print("  [skip] {0}: HTTP {1}".format(title, status_code))
            continue

        # Drop self-links. Wikipedia's own header links an article back to
        # itself, and a page voting for itself is not evidence of anything --
        # it is the simplest way there is to fake authority. Removing them here
        # means the graph never contains a self-loop for PageRank to recirculate.
        outgoing = [target for target in extract_wiki_links(html) if target != title]

        pages[title] = extract_visible_text(html)

        for target in outgoing:
            edges.append((title, target))
            if target not in seen_titles:
                seen_titles.add(target)
                queue.append(target)

        if verbose:
            print("  [{0:>4}/{1}] {2}  ({3} links, queue {4})"
                  .format(len(pages), max_pages, title, len(outgoing),
                          len(queue) - read_head))

        # Sleep AFTER the fetch, and only on success, so a page we skipped
        # instantly does not also cost us a second of wall-clock time.
        time.sleep(delay_seconds)

    # ---- keep only edges whose target we actually fetched -------------------
    # A 150-page crawl discovers roughly 30,000 distinct link targets, but only
    # fetches 150 of them. Keeping edges to the other ~29,850 would add that many
    # nodes to the graph, every one of them dangling, and PageRank would spend
    # almost all of its score on pages we know nothing about. DAD Section 5 states
    # the rule directly: only edges between crawled pages become graph edges.
    kept_edges = [(source, target) for source, target in edges if target in pages]

    if verbose:
        print("\n  crawled {0} pages, {1} skipped".format(len(pages), failure_count))
        print("  {0} raw links found, {1} kept as edges between crawled pages"
              .format(len(edges), len(kept_edges)))

    return kept_edges, pages


def write_edges_file(edges, path=EDGES_FILE):
    """Write the edge list to a tab-separated text file.

    Args:
        edges: list of (source, target) title pairs.
        path:  output filename, default edges.txt.

    Returns:
        int: the number of lines written.

    Format is one "SOURCE<TAB>TARGET" per line. A TAB separates the fields
    because Wikipedia titles may contain almost any character except tab, so a
    comma or a space would be ambiguous. newline="" is not used; we open the
    file in text mode and let Python write the platform's own line ending, since
    read_edges_file() below strips both forms.
    """
    with open(path, "w", encoding="utf-8") as edges_file:
        for source, target in edges:
            edges_file.write("{0}\t{1}\n".format(source, target))
    return len(edges)


def read_edges_file(path=EDGES_FILE):
    """Read an edge list back from disk, so ranking can run without a crawl.

    Args:
        path: the edges file to read.

    Returns:
        list of (source, target) pairs; an empty list if the file is missing.

    This is what makes SRS NFR4 true in practice -- with edges.txt committed to
    the repository, the whole ranking and search pipeline runs with no network
    access at all, which matters if the internet fails during the viva demo.
    """
    if not os.path.exists(path):
        return []

    edges = []
    with open(path, "r", encoding="utf-8") as edges_file:
        for line in edges_file:
            source, tab, target = line.rstrip("\r\n").partition("\t")
            # Guard against blank or malformed lines rather than trusting the
            # file, since it is a plain text file a person could easily edit.
            if tab and source and target:
                edges.append((source, target))
    return edges


if __name__ == "__main__":
    print("=" * 70)
    print("crawler.py  --  demo")
    print("=" * 70)

    # -------------------------------------------------------------------------
    # DEMO 1 (Checkpoint 7) -- plain HTTP over a raw socket, no TLS.
    #
    # example.com is used because it is maintained by IANA precisely as a stable
    # target for documentation and testing, it still answers plain HTTP on port
    # 80, and its page is small enough to read in full.
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("DEMO 1  --  plain HTTP GET over a raw TCP socket (no TLS)")
    print("-" * 70)
    print("\nRequest we are about to send on the wire:\n")
    print(build_http_get_request("example.com", "/").decode("ascii"))

    try:
        plain_status, plain_headers, plain_html = fetch("example.com", "/", use_tls=False)
        print("  status code : {0}".format(plain_status))
        print("  server      : {0}".format(plain_headers.get("server", "(not sent)")))
        print("  content-type: {0}".format(plain_headers.get("content-type", "(not sent)")))
        print("\n  first 200 bytes of body:")
        print("  " + repr(plain_html[:200]))
    except OSError as error:
        print("  plain HTTP fetch failed: {0}".format(error))
        print("  (needs internet access; the parsing code above still runs offline)")

    # -------------------------------------------------------------------------
    # DEMO 2 (Checkpoint 8) -- HTTPS through TLS, with chunked decoding.
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("DEMO 2  --  HTTPS GET through ssl, with chunked body decoding")
    print("-" * 70)
    try:
        secure_status, secure_headers, secure_html = fetch(WIKI_HOST, WIKI_PATH_PREFIX + "PageRank")
        print("  status code       : {0}".format(secure_status))
        print("  transfer-encoding : {0}".format(secure_headers.get("transfer-encoding", "(none)")))
        print("  decoded HTML size : {0} characters".format(len(secure_html)))
        print("\n  first 200 characters of decoded body:")
        print("  " + repr(secure_html[:200]))

        found_links = extract_wiki_links(secure_html)
        print("\n  extracted {0} distinct article links; first 10:".format(len(found_links)))
        for link_title in found_links[:10]:
            print("    -> {0}".format(link_title))
    except OSError as error:
        print("  HTTPS fetch failed: {0}".format(error))

    # A hand-written chunked body, decoded offline, so this part of the demo
    # proves the decoder works even with no internet connection at all.
    print("\n  Offline check of decode_chunked_body():")
    sample_chunked = b"1a\r\nPageRank scores every page\r\n5\r\n here\r\n0\r\n\r\n"
    print("    raw     :", sample_chunked)
    print("    decoded :", decode_chunked_body(sample_chunked))

    # -------------------------------------------------------------------------
    # DEMO 3 (Checkpoint 9) -- a small breadth-first crawl writing edges.txt.
    #
    # max_pages is kept low here so the demo finishes in about half a minute.
    # The real data-collection run (Checkpoint 12) uses max_pages=150 to meet
    # the 100-300 page requirement of FR1.7.
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("DEMO 3  --  breadth-first crawl (small, demo-sized)")
    print("-" * 70)
    SEED_TITLES = ["PageRank", "Search_engine"]
    DEMO_MAX_PAGES = 12

    print("\n  seeds     : {0}".format(", ".join(SEED_TITLES)))
    print("  max pages : {0}".format(DEMO_MAX_PAGES))
    print("  delay     : {0}s between requests\n".format(CRAWL_DELAY_SECONDS))

    try:
        crawled_edges, crawled_pages = crawl(SEED_TITLES, DEMO_MAX_PAGES)
        if crawled_edges:
            written = write_edges_file(crawled_edges)
            print("\n  wrote {0} edges to {1}".format(written, EDGES_FILE))
            print("\n  first 10 lines of {0}:".format(EDGES_FILE))
            for source_title, target_title in crawled_edges[:10]:
                print("    {0}\t{1}".format(source_title, target_title))
        else:
            print("\n  no edges collected (crawl produced nothing to write)")
    except OSError as error:
        print("  crawl failed: {0}".format(error))
        print("  cached edges on disk: {0} edges".format(len(read_edges_file())))

    print("=" * 70)
