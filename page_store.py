"""
===============================================================================
 page_store.py  --  Append-only flat-file page store
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Rudraksh Shah (2024300214)
 CHECKPOINT   : 7  (append-only flat file + insert())
                -- Checkpoint 8 adds the byte-offset index and get()
 SRS MAPPING  : FR2.1
 DAD MAPPING  : Design of Algorithm document, Section 4 "Hash-Based File Index"

 PURPOSE
 -------
 Hold every crawled page on disk, without SQLite, without an ORM, without any
 database engine at all. This checkpoint covers writing records; Checkpoint 8
 adds the index that makes reading one back fast.

 THE FILE FORMAT
 ---------------
 One record per line, four fields separated by a vertical bar:

     id|title|outlink_count|text

     PageRank|PageRank|187|PageRank is an algorithm used by Google Search ...

 Append-only: a new record goes on the end and nothing already written is ever
 moved. That is what keeps every byte offset we recorded permanently valid.

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

 The __main__ block inserts a few sample records and prints the raw file.
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
    """An append-only page store.

    Matches the SimplePageStore class in the Checkpoint 5 UML class diagram.
    This checkpoint implements insert(); get() and the index arrive next.

    Attributes:
        path:  the data file on disk.
        index: dict page_id -> byte offset where that record's line starts.
               Recorded on every insert, and used by get() from Checkpoint 8.
    """

    def __init__(self, path=DEFAULT_DB_PATH, reset=False):
        """Open (or create) a store.

        Args:
            path:  data file to use.
            reset: True to delete any existing file first. Used by the demo so
                   repeated runs start clean instead of appending onto
                   yesterday's records.
        """
        self.path = path

        if reset and os.path.exists(self.path):
            os.remove(self.path)

        # page_id -> byte offset of the first character of that record's line.
        self.index = {}

        # Where the next record will start. Tracked in memory rather than being
        # asked of the file on every insert, because append mode does not give a
        # reliable tell() before the first write, and re-stat-ing the file for
        # every insert is wasted system calls.
        self._write_offset = os.path.getsize(self.path) if os.path.exists(self.path) else 0

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
    print("=" * 70)
