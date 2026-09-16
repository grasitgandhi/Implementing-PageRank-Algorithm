"""
===============================================================================
 search_engine.py  --  Text relevance scoring, built from scratch
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Rudraksh Shah (2024300214)
 CHECKPOINT   : 9  (tokenize + term frequency)
                -- Checkpoint 10 adds IDF and cosine similarity
                -- Checkpoint 12 adds the SearchEngine class and score fusion
 SRS MAPPING  : FR5.2  (text relevance scoring)
 DAD MAPPING  : Design of Algorithm document, Section 7 "TF-IDF and Score Fusion"

 PURPOSE
 -------
 PageRank answers "how important is this page?" but says nothing about what the
 page is about. This module is the other half of the ranking: given a query, how
 well does this page's TEXT match it. The two are combined in Checkpoint 12.

 The measure is TF-IDF, which has two halves. This checkpoint builds the first:

     TF (term frequency)
         how often a word appears in one document, as a FRACTION of that
         document's total words:

             tf(term, document) = count of term in document
                                  ---------------------------
                                  total words in document

 WHY THE FRACTION, NOT THE RAW COUNT
 -----------------------------------
 A 5000-word Wikipedia article will contain the word "algorithm" more times than
 a 100-word stub does, simply because it is longer. Raw counts would rank every
 long page above every short one regardless of what they are about. Dividing by
 the document length asks the right question instead: what SHARE of this page is
 about this word. A 100-word page that says "algorithm" four times (tf = 0.04) is
 more about algorithms than a 5000-word page that says it ten times (tf = 0.002).

 IS THIS MACHINE LEARNING?  NO.
 ------------------------------
 TF-IDF has no training phase, no model parameters, no data it learns from. It is
 arithmetic on word counts, defined in full by the two formulas above and in
 Checkpoint 10. Every number it produces can be recomputed by hand -- which the
 demo below does -- and that is exactly why it satisfies the project's no-ML
 constraint while still being a genuine relevance signal.

 DEPENDENCIES
 ------------
 Standard library only: re, collections.Counter. (math is added in Checkpoint 10
 for the logarithm in IDF.)

 HOW TO RUN
 ----------
     python search_engine.py

 The __main__ block tokenises three sample sentences and prints the resulting
 term-frequency dictionaries, plus a hand-check of one value.
===============================================================================
"""

import re
from collections import Counter


# -----------------------------------------------------------------------------
# TOKENISING CONSTANTS
# -----------------------------------------------------------------------------

# A token is one or more letters or digits. Everything else -- punctuation,
# brackets, quotes, whitespace -- acts as a separator.
#
# Digits are kept because page titles and article text are full of meaningful
# numbers ("HTTP/1.1", "1998", "2024"), and a query for "PageRank 1998" should
# be able to match the year.
#
# Apostrophes are deliberately NOT kept, so "Google's" tokenises to ["google",
# "s"]. The stray "s" is harmless: it appears in so many documents that its IDF
# in Checkpoint 10 drives its weight almost to zero automatically.
TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


def tokenize(text):
    """Split raw text into a list of comparable word tokens.

    Args:
        text: any string -- a page's extracted text, or a user's query.

    Returns:
        list of lowercase tokens, in the order they appear. Repeats are kept,
        because term FREQUENCY is the whole point; deduplicating here would
        throw away the counts we are about to take.

    Example:
        >>> tokenize("PageRank ranks pages. PageRank, again!")
        ['pagerank', 'ranks', 'pages', 'pagerank', 'again']
    """
    # Lowercase FIRST, then match. The pattern only accepts a-z, so lowercasing
    # afterwards would silently drop every capitalised word -- and every page
    # starts its sentences with one. The order of these two lines matters.
    return TOKEN_PATTERN.findall(text.lower())


def compute_tf(tokens):
    """Compute the term frequency of every word in one document.

    Args:
        tokens: list of tokens for a single document, from tokenize().

    Returns:
        dict token -> float, where each value is that token's share of the
        document, so the values sum to 1.0. An empty document returns {}.

    Example:
        >>> sorted(compute_tf(["a", "b", "a", "a"]).items())
        [('a', 0.75), ('b', 0.25)]
    """
    total_tokens = len(tokens)

    if total_tokens == 0:
        # An empty page is possible -- a fetch can return a page whose body is
        # all navigation markup. Returning {} lets it score zero on every query
        # instead of raising ZeroDivisionError and taking the search down.
        return {}

    # Counter does one pass over the list and hands back token -> raw count.
    # It is the one collections import the project's library allowance permits,
    # and writing the same loop by hand would be slower and no clearer.
    raw_counts = Counter(tokens)

    # Divide each raw count by the document length -- see the file header for
    # why normalising by length is what makes long and short pages comparable.
    return {token: count / total_tokens for token, count in raw_counts.items()}


def print_tf(term_frequencies, top_n=8):
    """Print a term-frequency dictionary as a readable ranked table.

    Args:
        term_frequencies: dict token -> tf value, from compute_tf().
        top_n:            how many of the highest-scoring terms to show.

    Sorted by (-tf, token): frequency descending, then alphabetically, so that
    terms that tie do not shuffle their order between runs.
    """
    ranked = sorted(term_frequencies.items(), key=lambda pair: (-pair[1], pair[0]))
    for token, frequency in ranked[:top_n]:
        print("      {0:<14} tf = {1:.4f}".format(token, frequency))

    if len(ranked) > top_n:
        print("      ... and {0} more terms".format(len(ranked) - top_n))


if __name__ == "__main__":
    print("=" * 70)
    print("search_engine.py  --  demo (Checkpoint 9: tokenize + term frequency)")
    print("=" * 70)

    SAMPLE_DOCUMENTS = {
        "doc1": "PageRank ranks web pages. PageRank uses links between pages.",
        "doc2": "A hyperlink is a link from one web page to another web page.",
        "doc3": "Search engines rank pages by relevance and by importance.",
    }

    # -------------------------------------------------------------------------
    # Step 1: tokenising.
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("STEP 1  --  tokenize(): lowercase, drop punctuation, split on the rest")
    print("-" * 70)

    tokenised_documents = {}
    for document_id, document_text in SAMPLE_DOCUMENTS.items():
        tokens = tokenize(document_text)
        tokenised_documents[document_id] = tokens
        print("\n  {0}: {1!r}".format(document_id, document_text))
        print("    -> {0} tokens: {1}".format(len(tokens), tokens))

    # -------------------------------------------------------------------------
    # Step 2: term frequency.
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("STEP 2  --  compute_tf(): each term's share of its own document")
    print("-" * 70)

    term_frequency_tables = {}
    for document_id, tokens in tokenised_documents.items():
        term_frequencies = compute_tf(tokens)
        term_frequency_tables[document_id] = term_frequencies
        print("\n  {0}  ({1} tokens, {2} distinct terms):"
              .format(document_id, len(tokens), len(term_frequencies)))
        print_tf(term_frequencies)

    # -------------------------------------------------------------------------
    # Step 3: a hand-check, because SRS NFR9 requires every computed number to
    # be reproducible on paper.
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("STEP 3  --  hand-check of one value")
    print("-" * 70)

    doc1_tokens = tokenised_documents["doc1"]
    pagerank_occurrences = doc1_tokens.count("pagerank")
    print("\n  doc1 has {0} tokens in total.".format(len(doc1_tokens)))
    print("  'pagerank' appears {0} times.".format(pagerank_occurrences))
    print("  By hand: {0} / {1} = {2:.4f}"
          .format(pagerank_occurrences, len(doc1_tokens),
                  pagerank_occurrences / len(doc1_tokens)))
    print("  compute_tf() returned : {0:.4f}"
          .format(term_frequency_tables["doc1"]["pagerank"]))

    print("\n  Also note every tf table sums to 1.0, by construction:")
    for document_id, term_frequencies in term_frequency_tables.items():
        print("    sum of tf values in {0} = {1:.6f}"
              .format(document_id, sum(term_frequencies.values())))

    print("\n  Next checkpoint (10): compute_idf() weights down words like 'web'")
    print("  and 'page' that appear in every document, and cosine_similarity()")
    print("  turns these tables into a single relevance number per page.")
    print("=" * 70)
