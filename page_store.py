"""
===============================================================================
 page_store.py  --  Append-only flat-file page store with a byte-offset index
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Rudraksh Shah (2024300214)
 CHECKPOINT   : 7  (append-only flat file + insert())
                8  (in-memory offset index + seek-based get() + benchmark)
 SRS MAPPING  : FR2.1, FR2.2, FR2.3, FR2.4, NFR2
 DAD MAPPING  : Design of Algorithm document, Section 4 "Hash-Based File Index"

 PURPOSE
 -------
 Hold every crawled page on disk and hand any one of them back quickly, without
 SQLite, without an ORM, without any database engine at all. This is the module
 that proves the project understands what a database index actually is, because
 we build one by hand.

 THE FILE FORMAT
 ---------------
 One record per line, four fields separated by a vertical bar:

     id|title|outlink_count|text

     PageRank|PageRank|187|PageRank is an algorithm used by Google Search ...

 Append-only: a new record goes on the end and nothing already written is ever
 moved. That is what keeps every byte offset we recorded permanently valid.

 THE INDEX, AND WHY IT IS THE POINT OF THIS MODULE
 -------------------------------------------------
 Finding a page by scanning the file means reading every line before the one you
 want: O(N) per lookup, and the search engine does thousands of lookups. Instead,
 on startup we read the file once and remember where each record BEGINS:

     index = { "PageRank": 0, "Google": 412, "Larry_Page": 1180, ... }

 A lookup is then a dict hit (O(1) average) followed by f.seek() straight to that
 byte and one readline() -- the operating system never touches the pages in
 between. This is precisely the mechanism a real database index provides, and the
 benchmark in the __main__ block below measures the difference on 1200 records.

 WHY THE FILE IS OPENED IN BINARY MODE EVERYWHERE
 ------------------------------------------------
 Byte offsets and Python's text mode do not mix, for two separate reasons, and
 both of them bite on Windows specifically:

   1. Text mode translates "\\n" into "\\r\\n" on write, so a record we thought was
      80 bytes long lands on disk as 82 and every offset after it is wrong.
   2. tell() on a text-mode file returns an opaque cookie, not a byte count, and
      is not valid to use the way we use it here.

 Opening with "rb"/"ab" and encoding to UTF-8 by hand makes the offsets exact on
 Windows, macOS and Linux alike (SRS NFR10).

 DEPENDENCIES
 ------------
 Standard library only: os. Nothing from PyPI.

 HOW TO RUN
 ----------
     python page_store.py

 The __main__ block inserts a few sample records, prints the raw file, shows
 the index built from it and looks a record up by id.
===============================================================================
"""

import os


# -----------------------------------------------------------------------------
# FORMAT CONSTANTS
# -----------------------------------------------------------------------------

# Default data file. Named .db because that is what it is to this project, but
# it is a plain text file -- open it in Notepad and every record is readable.
# It is listed in .gitignore because the crawler regenerates it.
DEFAULT_DB_PATH = "pages.db"

# Field separator. A vertical bar is used instead of a comma because page text
# is full of commas, and instead of a tab because edges.txt already uses tabs
# and keeping the two formats visibly different prevents mix-ups. Bars do appear
# occasionally in Wikipedia text, which is what _sanitise_field() handles.
FIELD_SEPARATOR = "|"

# Number of fields per record: id, title, outlink_count, text.
FIELD_COUNT = 4

# Records are UTF-8 on disk. Fixed explicitly rather than left to the platform
# default, because Windows would otherwise write cp1252 and the same file would
# fail to read on Linux -- and article text is full of accented characters.
FILE_ENCODING = "utf-8"


def _sanitise_field(value):
    """Make a value safe to write as one field of one line.

    Args:
        value: any value; converted to str first.

    Returns:
        str with the separator and all line breaks replaced by spaces.

    This is lossy on purpose. The alternative -- a full escaping scheme with a
    matching unescaper -- buys nothing here: the stored text exists only to be
    tokenised into words by search_engine.py, and swapping a stray "|" for a
    space changes no word count. What we cannot afford is an unescaped separator
    or newline silently splitting one record into two and corrupting every byte
    offset after it.
    """
    text = str(value)
    for character in (FIELD_SEPARATOR, "\r", "\n"):
        text = text.replace(character, " ")
    return text


class SimplePageStore:
    """An append-only page store with an in-memory byte-offset index.

    Matches the SimplePageStore class in the Checkpoint 5 UML class diagram:
    insert(), get(), and an index built at construction time.

    Attributes:
        path:  the data file on disk.
        index: dict page_id -> byte offset where that record's line starts.
    """

    def __init__(self, path=DEFAULT_DB_PATH, reset=False):
        """Open (or create) a store and build its index.

        Args:
            path:  data file to use.
            reset: True to delete any existing file first. Used by the demo and
                   the benchmark so repeated runs start clean instead of
                   appending onto yesterday's records.
        """
        self.path = path

        if reset and os.path.exists(self.path):
            os.remove(self.path)

        # page_id -> byte offset of the first character of that record's line.
        self.index = {}

        # Where the next record will start. Tracked in memory rather than being
        # asked of the file on every insert, because append mode does not give a
        # reliable tell() before the first write, and re-stat-ing the file for
        # every one of 1200 inserts is wasted system calls.
        self._write_offset = os.path.getsize(self.path) if os.path.exists(self.path) else 0

        # FR2.3 / FR2.4: rebuilding the index from disk at startup is what lets
        # the program reuse a previous crawl with no network access.
        self._build_index()

    # -- Checkpoint 7 ---------------------------------------------------------

    def insert(self, page_id, title, outlink_count, text):
        """Append one page record to the data file (FR2.1).

        Args:
            page_id:       unique identifier for the page (we use its title).
            title:         human-readable page title.
            outlink_count: how many outgoing links the page has. Stored so that
                           the search output can show it without loading the
                           whole link graph.
            text:          the page's visible text.

        Returns:
            int: the byte offset at which the record was written.

        Re-inserting an existing id is allowed and appends a second copy; the
        index is updated to the NEW offset, so get() returns the newest version
        and the old one simply becomes dead weight in the file. That is the
        standard append-only trade-off: writes stay O(1) and never rewrite the
        file, at the cost of some wasted space until a compaction pass.
        """
        record_line = FIELD_SEPARATOR.join([
            _sanitise_field(page_id),
            _sanitise_field(title),
            _sanitise_field(outlink_count),
            _sanitise_field(text),
        ]) + "\n"

        # Encode to bytes ourselves so that len() below is the exact number of
        # bytes that hit the disk. len() of the str would count characters, and
        # one accented character is two bytes in UTF-8 -- offsets would drift.
        encoded = record_line.encode(FILE_ENCODING)

        # "ab" = append, binary. Append mode guarantees the write lands at the
        # end of the file even if something else appended in between.
        with open(self.path, "ab") as data_file:
            data_file.write(encoded)

        offset = self._write_offset
        self.index[page_id] = offset
        self._write_offset += len(encoded)
        return offset

    # -- Checkpoint 8 ---------------------------------------------------------

    def _build_index(self):
        """Scan the data file once and record where each record starts (FR2.2).

        Returns:
            None; self.index is populated.

        Cost is O(N) but it happens exactly once, at startup. Every lookup after
        that is O(1), which is the whole trade: pay one linear pass to make
        thousands of subsequent lookups constant-time.
        """
        if not os.path.exists(self.path):
            return

        with open(self.path, "rb") as data_file:
            while True:
                # tell() BEFORE readline(), because we want the offset where the
                # record starts, not where it ends. In binary mode this is an
                # honest byte count.
                offset = data_file.tell()
                raw_line = data_file.readline()
                if not raw_line:
                    break  # end of file

                # Only the id is needed to index the record, and it is the first
                # field, so split with maxsplit=1 and stop. Decoding the whole
                # line -- including the page text -- just to throw it away would
                # make startup noticeably slower on a 300-page store.
                first_field, separator, _rest = raw_line.partition(
                    FIELD_SEPARATOR.encode(FILE_ENCODING))
                if not separator:
                    continue  # malformed or blank line; skip it rather than crash

                page_id = first_field.decode(FILE_ENCODING, errors="replace")

                # Last write wins, matching the re-insert behaviour documented
                # in insert(): later records overwrite earlier offsets.
                self.index[page_id] = offset

    def get(self, page_id):
        """Retrieve one record by id, jumping straight to it (FR2.2, NFR2).

        Args:
            page_id: the id to look up.

        Returns:
            dict with keys id, title, outlink_count, text -- or None if the id
            is not in the store. Returning None rather than raising, because a
            missing page is a normal outcome the search engine handles by
            skipping that result.
        """
        offset = self.index.get(page_id)
        if offset is None:
            return None  # O(1) miss: no disk access at all

        with open(self.path, "rb") as data_file:
            # The one line that makes this module worth writing: jump directly
            # to the record's first byte. Everything before it is never read.
            data_file.seek(offset)
            raw_line = data_file.readline()

        return self._parse_record(raw_line)

    def linear_scan_get(self, page_id):
        """Retrieve one record by reading the file from the top (no index).

        Args:
            page_id: the id to look up.

        Returns:
            the same dict get() would return, or None.

        This exists only as the control group for the benchmark below: it is the
        naive implementation the index replaces. Nothing in the real pipeline
        calls it.
        """
        target = page_id.encode(FILE_ENCODING) + FIELD_SEPARATOR.encode(FILE_ENCODING)

        with open(self.path, "rb") as data_file:
            for raw_line in data_file:
                # startswith on the raw bytes, so a record is rejected without
                # decoding it. Decoding every line would make the linear scan
                # look far worse than the indexing itself deserves credit for,
                # and an unfair benchmark proves nothing.
                if raw_line.startswith(target):
                    return self._parse_record(raw_line)
        return None

    def _parse_record(self, raw_line):
        """Turn one raw line of bytes back into a record dict.

        Args:
            raw_line: bytes for exactly one line, newline included or not.

        Returns:
            dict, or None if the line does not have all four fields.

        split with maxsplit=FIELD_COUNT-1 so that the text field keeps anything
        that looks like a separator -- though _sanitise_field should already
        have removed those on the way in, this makes the reader safe regardless.
        """
        line = raw_line.decode(FILE_ENCODING, errors="replace").rstrip("\r\n")
        fields = line.split(FIELD_SEPARATOR, FIELD_COUNT - 1)

        if len(fields) != FIELD_COUNT:
            return None

        page_id, title, outlink_count, text = fields
        return {
            "id": page_id,
            "title": title,
            # Stored as text on disk, handed back as an int because every caller
            # wants a number. int() guarded, because a corrupted line should
            # yield 0 rather than bring down the search.
            "outlink_count": int(outlink_count) if outlink_count.isdigit() else 0,
            "text": text,
        }

    def count(self):
        """Return how many distinct page ids are stored."""
        return len(self.index)

    def iter_records(self):
        """Yield every record in the store, in the order written.

        Used by search_engine.py to build TF-IDF vectors over the whole corpus,
        where we genuinely do want all of them and an index would not help.
        """
        if not os.path.exists(self.path):
            return

        with open(self.path, "rb") as data_file:
            for raw_line in data_file:
                record = self._parse_record(raw_line)
                if record is not None:
                    yield record


if __name__ == "__main__":
    print("=" * 70)
    print("page_store.py  --  demo")
    print("=" * 70)

    # -------------------------------------------------------------------------
    # DEMO 1 (Checkpoint 7) -- insert a few records, show the raw file.
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("DEMO 1  --  append-only insert(), and the raw file it produces")
    print("-" * 70)

    DEMO_DB = "demo_pages.db"
    demo_store = SimplePageStore(DEMO_DB, reset=True)

    SAMPLE_PAGES = [
        ("PageRank", "PageRank", 12,
         "PageRank is an algorithm that measures the importance of web pages using links."),
        ("Google_Search", "Google Search", 9,
         "Google Search is a web search engine that ranks results using many signals."),
        ("Larry_Page", "Larry Page", 5,
         "Larry Page is a computer scientist who co-created the PageRank algorithm."),
        ("Hyperlink", "Hyperlink", 7,
         "A hyperlink is a reference from one web page to another web page."),
    ]

    for sample in SAMPLE_PAGES:
        written_offset = demo_store.insert(*sample)
        print("  inserted {0:<14} at byte offset {1}".format(sample[0], written_offset))

    print("\n  Raw contents of {0}:\n".format(DEMO_DB))
    with open(DEMO_DB, "r", encoding=FILE_ENCODING) as demo_file:
        for line_number, file_line in enumerate(demo_file, start=1):
            print("  {0}: {1}".format(line_number, file_line.rstrip("\n")))

    print("\n  The in-memory index built from that file:")
    for stored_id, stored_offset in demo_store.index.items():
        print("    {0:<16} -> byte {1}".format(stored_id, stored_offset))

    print("\n  get('Larry_Page') -- one seek, no scanning:")
    print("   ", demo_store.get("Larry_Page"))
    print("\n  get('Not_A_Real_Page') on a missing id:")
    print("   ", demo_store.get("Not_A_Real_Page"))

    print("=" * 70)
