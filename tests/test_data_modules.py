"""
===============================================================================
 tests/test_data_modules.py  --  Consolidated tests for the data modules
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Aaditya Doshi (2024300053)
 CHECKPOINT   : 13 (Days 59-63)
 COVERS       : crawler.py (HTTP parsing), page_store.py (storage and index)
 SRS MAPPING  : FR1.2-FR1.4, FR2.1, FR2.2, NFR2, NFR8

 PURPOSE
 -------
 Test the two modules that touch the outside world -- without touching it. Every
 test here runs offline, on hand-written byte strings and temporary files, so the
 suite gives the same answer on a train with no signal as it does on campus.

 That matters more than it sounds. A test suite that needs the internet fails for
 reasons that have nothing to do with the code, and a suite that fails randomly
 gets ignored. The HTTP parsing is tested by feeding it a response captured as a
 literal, which also means we can test malformed responses that no real server
 would reliably produce on demand.

 HOW TO RUN
 ----------
     python tests/test_data_modules.py       (from the project root)

 Prints ALL TESTS PASSED at the end if everything holds. Needs no network.
===============================================================================
"""

import os
import sys

# The modules under test live one directory up. See the equivalent note in
# tests/test_math_modules.py about `sys` being the one module used beyond the
# project's agreed library list, and only in test files.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import crawler
import page_store


# A complete HTTP response, written out by hand. Using a literal rather than a
# live fetch means the expected values below are fixed and the test cannot fail
# because a real server changed its headers.
SAMPLE_RESPONSE = (
    b"HTTP/1.1 200 OK\r\n"
    b"Content-Type: text/html; charset=UTF-8\r\n"
    b"Server: nginx\r\n"
    b"Content-Length: 38\r\n"
    b"\r\n"
    b"<html><body>Hello world</body></html>\n"
)

# Temporary file names used by the storage tests, removed afterwards.
TEST_DB = "test_page_store.db"


# =============================================================================
# crawler.py  --  request building
# =============================================================================

def test_request_has_a_valid_request_line():
    """The first line must be exactly 'GET <path> HTTP/1.1'."""
    request = crawler.build_http_get_request("example.com", "/wiki/PageRank")
    first_line = request.split(b"\r\n")[0]

    assert first_line == b"GET /wiki/PageRank HTTP/1.1", \
        "bad request line: {0!r}".format(first_line)
    print("PASS  test_request_has_a_valid_request_line")


def test_request_ends_with_a_blank_line():
    """Headers must be terminated by CRLF CRLF, or the server waits forever."""
    request = crawler.build_http_get_request("example.com", "/")

    assert request.endswith(b"\r\n\r\n"), \
        "request must end with a blank line, got {0!r}".format(request[-6:])
    print("PASS  test_request_ends_with_a_blank_line")


def test_request_carries_the_mandatory_host_header():
    """HTTP/1.1 requires Host. Without it a shared-hosting server answers 400."""
    request = crawler.build_http_get_request("en.wikipedia.org", "/")

    assert b"Host: en.wikipedia.org\r\n" in request, "Host header missing"
    print("PASS  test_request_carries_the_mandatory_host_header")


def test_request_refuses_compression():
    """We ask for identity encoding because we have no decompression code.

    If this header ever goes missing, servers will send gzip and every page will
    arrive as unreadable binary -- a failure that looks like a parsing bug.
    """
    request = crawler.build_http_get_request("example.com", "/")

    assert b"Accept-Encoding: identity\r\n" in request, \
        "Accept-Encoding: identity is required -- we cannot decompress gzip"
    print("PASS  test_request_refuses_compression")


# =============================================================================
# crawler.py  --  response parsing
# =============================================================================

def test_parse_extracts_the_status_code():
    """'HTTP/1.1 200 OK' must yield the integer 200, not the string."""
    status_code, _headers, _body = crawler.parse_http_response(SAMPLE_RESPONSE)

    assert status_code == 200, "expected 200, got {0!r}".format(status_code)
    assert isinstance(status_code, int), "status code must be an int"
    print("PASS  test_parse_extracts_the_status_code")


def test_parse_lowercases_header_names():
    """Header names are case-insensitive, so we normalise them on the way in."""
    _status, headers, _body = crawler.parse_http_response(SAMPLE_RESPONSE)

    assert headers["content-type"] == "text/html; charset=UTF-8", \
        "content-type wrong: {0!r}".format(headers.get("content-type"))
    assert headers["server"] == "nginx"
    assert "Content-Type" not in headers, "header names should be lowercased"
    print("PASS  test_parse_lowercases_header_names")


def test_parse_separates_body_from_headers():
    """The body is everything after the first blank line, and nothing before."""
    _status, _headers, body = crawler.parse_http_response(SAMPLE_RESPONSE)

    assert body == b"<html><body>Hello world</body></html>\n", \
        "body wrong: {0!r}".format(body)
    assert b"Content-Type" not in body, "headers leaked into the body"
    print("PASS  test_parse_separates_body_from_headers")


def test_parse_survives_a_malformed_response():
    """Rubbish in must not crash -- status 0 signals 'unparseable' (NFR6)."""
    status_code, headers, body = crawler.parse_http_response(b"not an http response")

    assert status_code == 0, "expected 0 for malformed input, got {0!r}".format(status_code)
    assert headers == {}
    assert body == b""
    print("PASS  test_parse_survives_a_malformed_response")


def test_parse_handles_a_404():
    """A missing page is an ordinary event, parsed like any other response."""
    response = b"HTTP/1.1 404 Not Found\r\nContent-Type: text/html\r\n\r\ngone"
    status_code, headers, body = crawler.parse_http_response(response)

    assert status_code == 404, "expected 404, got {0!r}".format(status_code)
    assert body == b"gone"
    print("PASS  test_parse_handles_a_404")


# =============================================================================
# crawler.py  --  chunked transfer encoding
# =============================================================================

def test_chunked_body_is_reassembled():
    """Chunk sizes are HEXADECIMAL, and the framing must be stripped out.

    1a = 26 bytes ("PageRank scores every page"), then 5 bytes (" here"),
    then the zero chunk that ends the body.
    """
    chunked = b"1a\r\nPageRank scores every page\r\n5\r\n here\r\n0\r\n\r\n"
    decoded = crawler.decode_chunked_body(chunked)

    assert decoded == b"PageRank scores every page here", \
        "decoded wrongly: {0!r}".format(decoded)
    print("PASS  test_chunked_body_is_reassembled")


def test_chunk_size_is_read_as_hex_not_decimal():
    """A size of 'f' means 15 bytes. Read as decimal it would mean nothing.

    This is the single easiest bug to stare past in the whole crawler, so it
    gets its own test with a size that is unambiguous: 'f' is not valid decimal.
    """
    chunked = b"f\r\nfifteen bytes!\n\r\n0\r\n\r\n"
    decoded = crawler.decode_chunked_body(chunked)

    assert len(decoded) == 15, "expected 15 bytes, got {0}".format(len(decoded))
    print("PASS  test_chunk_size_is_read_as_hex_not_decimal")


def test_truncated_chunked_body_does_not_raise():
    """A body cut short mid-chunk returns what it has, rather than crashing.

    This really happens: MAX_RESPONSE_BYTES stops the read on an oversized page.
    A partial page is still worth extracting links from.
    """
    truncated = b"1a\r\nPageRank scores every page\r\n5\r\n he"
    decoded = crawler.decode_chunked_body(truncated)

    assert decoded.startswith(b"PageRank scores every page"), \
        "should have decoded the complete first chunk, got {0!r}".format(decoded)
    print("PASS  test_truncated_chunked_body_does_not_raise")


# =============================================================================
# crawler.py  --  link extraction
# =============================================================================

def test_links_are_extracted_in_both_href_forms():
    """Wikipedia serves relative AND absolute hrefs; both must be caught.

    This was a real bug: a relative-only pattern found 44 links on a page that
    contained 455, because most were written in the absolute form.
    """
    html = ('<a href="/wiki/Algorithm">one</a>'
            '<a href="https://en.wikipedia.org/wiki/Larry_Page">two</a>')
    links = crawler.extract_wiki_links(html)

    assert "Algorithm" in links, "relative href missed: {0!r}".format(links)
    assert "Larry_Page" in links, "absolute href missed: {0!r}".format(links)
    print("PASS  test_links_are_extracted_in_both_href_forms")


def test_namespace_and_language_links_are_rejected():
    """Category:, File:, Help: and other-language editions are not articles."""
    html = ('<a href="/wiki/Category:Algorithms">cat</a>'
            '<a href="/wiki/File:Diagram.png">file</a>'
            '<a href="/wiki/Help:Contents">help</a>'
            '<a href="https://ar.wikipedia.org/wiki/Foo">arabic</a>'
            '<a href="/wiki/Real_Article">keep</a>')
    links = crawler.extract_wiki_links(html)

    assert links == ["Real_Article"], \
        "only the real article should survive, got {0!r}".format(links)
    print("PASS  test_namespace_and_language_links_are_rejected")


def test_anchors_and_duplicates_collapse_to_one_link():
    """/wiki/Cat#History and /wiki/Cat are the same page, counted once."""
    html = ('<a href="/wiki/Cat#History">a</a>'
            '<a href="/wiki/Cat">b</a>'
            '<a href="/wiki/Cat">c</a>')
    links = crawler.extract_wiki_links(html)

    assert links == ["Cat"], "expected a single 'Cat', got {0!r}".format(links)
    print("PASS  test_anchors_and_duplicates_collapse_to_one_link")


def test_scripts_and_tags_are_stripped_from_text():
    """Visible text must exclude markup and script contents entirely."""
    html = ("<html><head><style>body{color:red}</style>"
            "<script>var x = 'hidden';</script></head>"
            "<body><p>Real visible text</p></body></html>")
    text = crawler.extract_visible_text(html)

    assert "Real visible text" in text, "visible text lost: {0!r}".format(text)
    assert "hidden" not in text, "script contents leaked into the text"
    assert "color:red" not in text, "style contents leaked into the text"
    assert "<p>" not in text, "tags were not stripped"
    print("PASS  test_scripts_and_tags_are_stripped_from_text")


def test_url_splitting():
    """split_url must handle absolute and root-relative forms."""
    host, port, path, use_tls = crawler.split_url("https://en.wikipedia.org/wiki/X", "fallback")
    assert (host, port, path, use_tls) == ("en.wikipedia.org", 443, "/wiki/X", True), \
        "absolute https parsed wrongly: {0!r}".format((host, port, path, use_tls))

    host, port, path, use_tls = crawler.split_url("/wiki/Relative", "en.wikipedia.org")
    assert host == "en.wikipedia.org", "root-relative should keep the current host"
    assert path == "/wiki/Relative"

    host, port, path, use_tls = crawler.split_url("http://example.com/page", "fallback")
    assert (host, port, use_tls) == ("example.com", 80, False), \
        "plain http parsed wrongly: {0!r}".format((host, port, use_tls))
    print("PASS  test_url_splitting")


# =============================================================================
# page_store.py
# =============================================================================

def test_insert_then_get_returns_the_same_record():
    """The basic round trip: what goes in must come back out unchanged."""
    store = page_store.SimplePageStore(TEST_DB, reset=True)
    store.insert("PageRank", "PageRank", 12, "an algorithm for ranking web pages")

    record = store.get("PageRank")

    assert record is not None, "get() returned None for a record just inserted"
    assert record["id"] == "PageRank"
    assert record["title"] == "PageRank"
    assert record["outlink_count"] == 12, \
        "outlink_count should come back as an int, got {0!r}".format(record["outlink_count"])
    assert record["text"] == "an algorithm for ranking web pages"
    print("PASS  test_insert_then_get_returns_the_same_record")


def test_get_on_a_missing_id_returns_none():
    """A missing page is a normal outcome, so get() returns None rather than raising."""
    store = page_store.SimplePageStore(TEST_DB, reset=True)
    store.insert("A", "A", 1, "text")

    assert store.get("DoesNotExist") is None, "expected None for an unknown id"
    print("PASS  test_get_on_a_missing_id_returns_none")


def test_index_offsets_point_at_real_record_starts():
    """Each recorded offset must land exactly on the first byte of its record.

    This is the test that catches newline-translation corruption. If the file
    were opened in text mode on Windows, every offset after the first would be
    off by one byte per preceding record and this would fail.
    """
    store = page_store.SimplePageStore(TEST_DB, reset=True)
    store.insert("first", "First", 1, "alpha")
    store.insert("second", "Second", 2, "beta")
    store.insert("third", "Third", 3, "gamma")

    assert store.index["first"] == 0, "the first record must start at byte 0"

    for page_id in ("first", "second", "third"):
        record = store.get(page_id)
        assert record is not None and record["id"] == page_id, \
            "offset for {0!r} did not land on its own record".format(page_id)
    print("PASS  test_index_offsets_point_at_real_record_starts")


def test_index_survives_being_rebuilt_from_disk():
    """A fresh store object must rebuild the same index by scanning the file.

    This is FR2.3/FR2.4: reload previously crawled data without re-crawling.
    """
    store = page_store.SimplePageStore(TEST_DB, reset=True)
    store.insert("alpha", "Alpha", 1, "first page")
    store.insert("beta", "Beta", 2, "second page")

    # A brand-new object over the same file, with no memory of the inserts.
    reopened = page_store.SimplePageStore(TEST_DB, reset=False)

    assert reopened.count() == 2, "expected 2 records, got {0}".format(reopened.count())
    assert reopened.get("beta")["text"] == "second page", "record lost across reopen"
    print("PASS  test_index_survives_being_rebuilt_from_disk")


def test_separator_in_text_cannot_corrupt_a_record():
    """A '|' inside page text must not split the record into extra fields."""
    store = page_store.SimplePageStore(TEST_DB, reset=True)
    store.insert("weird", "Weird", 1, "text with | a bar and more")

    record = store.get("weird")

    assert record is not None, "record with a bar in its text could not be read back"
    assert record["title"] == "Weird", \
        "fields shifted: title came back as {0!r}".format(record["title"])
    assert record["outlink_count"] == 1
    print("PASS  test_separator_in_text_cannot_corrupt_a_record")


def test_newline_in_text_cannot_split_a_record():
    """A newline inside page text would otherwise create a phantom second record."""
    store = page_store.SimplePageStore(TEST_DB, reset=True)
    store.insert("multi", "Multi", 1, "line one\nline two\nline three")

    assert store.count() == 1, \
        "text with newlines created {0} records instead of 1".format(store.count())
    assert store.get("multi") is not None
    print("PASS  test_newline_in_text_cannot_split_a_record")


def test_indexed_and_linear_lookups_agree():
    """The fast path and the slow path must return identical records.

    If they ever disagreed, the Checkpoint 8 benchmark would be timing two
    different operations and the speedup figure would be meaningless.
    """
    store = page_store.SimplePageStore(TEST_DB, reset=True)
    for number in range(20):
        store.insert("p{0}".format(number), "Page {0}".format(number), number, "text")

    for number in range(20):
        page_id = "p{0}".format(number)
        assert store.get(page_id) == store.linear_scan_get(page_id), \
            "indexed and linear lookups disagree on {0!r}".format(page_id)
    print("PASS  test_indexed_and_linear_lookups_agree")


def test_reinserting_an_id_returns_the_newest_version():
    """Append-only means the latest write wins on read."""
    store = page_store.SimplePageStore(TEST_DB, reset=True)
    store.insert("dup", "Old title", 1, "old text")
    store.insert("dup", "New title", 2, "new text")

    record = store.get("dup")

    assert record["title"] == "New title", \
        "expected the newest version, got {0!r}".format(record["title"])
    assert store.count() == 1, "one id should mean one index entry"
    print("PASS  test_reinserting_an_id_returns_the_newest_version")


def cleanup():
    """Remove the temporary database so repeated runs start clean."""
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)


if __name__ == "__main__":
    print("=" * 70)
    print("tests/test_data_modules.py")
    print("=" * 70)
    print()

    try:
        print("-- crawler.py: request building " + "-" * 36)
        test_request_has_a_valid_request_line()
        test_request_ends_with_a_blank_line()
        test_request_carries_the_mandatory_host_header()
        test_request_refuses_compression()

        print("\n-- crawler.py: response parsing " + "-" * 36)
        test_parse_extracts_the_status_code()
        test_parse_lowercases_header_names()
        test_parse_separates_body_from_headers()
        test_parse_survives_a_malformed_response()
        test_parse_handles_a_404()

        print("\n-- crawler.py: chunked encoding " + "-" * 36)
        test_chunked_body_is_reassembled()
        test_chunk_size_is_read_as_hex_not_decimal()
        test_truncated_chunked_body_does_not_raise()

        print("\n-- crawler.py: link and text extraction " + "-" * 28)
        test_links_are_extracted_in_both_href_forms()
        test_namespace_and_language_links_are_rejected()
        test_anchors_and_duplicates_collapse_to_one_link()
        test_scripts_and_tags_are_stripped_from_text()
        test_url_splitting()

        print("\n-- page_store.py " + "-" * 51)
        test_insert_then_get_returns_the_same_record()
        test_get_on_a_missing_id_returns_none()
        test_index_offsets_point_at_real_record_starts()
        test_index_survives_being_rebuilt_from_disk()
        test_separator_in_text_cannot_corrupt_a_record()
        test_newline_in_text_cannot_split_a_record()
        test_indexed_and_linear_lookups_agree()
        test_reinserting_an_id_returns_the_newest_version()
    finally:
        # Run even if a test fails, so a failure never leaves a stray file
        # behind to confuse the next run.
        cleanup()

    print()
    print("=" * 70)
    print("ALL TESTS PASSED")
    print("=" * 70)
