"""
===============================================================================
 search_engine.py  --  Text relevance scoring, built from scratch
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Rudraksh Shah (2024300214)
 CHECKPOINT   : 9  (tokenize + term frequency)
                10 (IDF, TF-IDF vectors, cosine similarity)
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
 Standard library only: math, re, collections.Counter.

 HOW TO RUN
 ----------
     python search_engine.py

 The __main__ block walks a small corpus through every stage: tokenising, term
 frequency, IDF, TF-IDF vectors and cosine similarity.
===============================================================================
"""

import math
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

# =============================================================================
# CHECKPOINT 10 -- inverse document frequency, TF-IDF vectors, cosine similarity
# =============================================================================
#
# Term frequency alone has a blind spot: the commonest words score highest. In a
# corpus of web pages "the", "page" and "web" appear constantly, so a tf table is
# dominated by words that say nothing about what a page is actually about.
#
# IDF is the correction. It asks how RARE a word is across the whole collection:
#
#     idf(term) = log( N / (1 + df(term)) )
#
# where N is the number of documents and df is how many of them contain the term.
# A word in every document gets a weight near zero; a word in one document out of
# a hundred gets a large one. Multiplying tf by idf gives a score that is high
# only when a word is both frequent HERE and rare ELSEWHERE -- which is exactly
# what "this page is about X" means.


def compute_df(tokenised_documents):
    """Count how many documents each term appears in at least once.

    Args:
        tokenised_documents: dict doc_id -> list of tokens.

    Returns:
        dict term -> document frequency.

    Note the per-document set(): a term is counted ONCE per document however
    often it occurs there. Document frequency asks "in how many documents", not
    "how many times in total" -- that second question is what tf answers.
    """
    document_frequency = {}

    for tokens in tokenised_documents.values():
        for term in set(tokens):
            document_frequency[term] = document_frequency.get(term, 0) + 1

    return document_frequency


def compute_idf(tokenised_documents):
    """Compute the inverse document frequency of every term in the corpus.

    Args:
        tokenised_documents: dict doc_id -> list of tokens.

    Returns:
        dict term -> idf value.

    The +1 in the denominator is smoothing. Without it a term present in zero
    documents divides by zero -- impossible for terms drawn from the corpus
    itself, but entirely possible the moment a QUERY introduces a word the corpus
    has never seen. The +1 makes the formula total.

    One honest consequence, worth knowing before the viva: a term appearing in
    EVERY document gives log(N / (N+1)), which is slightly NEGATIVE rather than
    zero. That is a property of this smoothed form, not a bug -- it means a
    universally common word counts against a match instead of merely being
    ignored. The unsmoothed variant log(N / df) would give exactly zero instead.
    """
    document_count = len(tokenised_documents)
    document_frequency = compute_df(tokenised_documents)

    # math.log is the natural logarithm. The base does not matter for ranking:
    # changing it multiplies every idf by the same constant, which scales all
    # scores equally and leaves their ORDER -- the only thing we use -- unchanged.
    return {
        term: math.log(document_count / (1 + frequency))
        for term, frequency in document_frequency.items()
    }


def build_tfidf_vector(tokens, idf):
    """Turn one document's tokens into its TF-IDF vector.

    Args:
        tokens: list of tokens for a single document.
        idf:    dict term -> idf, computed once across the whole corpus.

    Returns:
        dict term -> tf * idf. Terms absent from idf are skipped, which is how a
        query word the corpus has never seen contributes nothing rather than
        raising a KeyError.

    This is a SPARSE vector: conceptually it has one dimension per term in the
    entire vocabulary, but only the non-zero entries are stored. A 150-page
    corpus has tens of thousands of distinct terms while any single page uses a
    few hundred, so storing the zeros would waste almost all of the memory.
    """
    term_frequencies = compute_tf(tokens)

    return {
        term: frequency * idf[term]
        for term, frequency in term_frequencies.items()
        if term in idf
    }


def vector_magnitude(vector):
    """Return the length of a sparse vector: sqrt of the sum of its squares.

    Only stored terms are summed, which is correct because every term not stored
    has value 0 and contributes 0 to the total.
    """
    return math.sqrt(sum(value * value for value in vector.values()))


def cosine_similarity(vector_a, vector_b):
    """Measure how alike two TF-IDF vectors are, from 0.0 to 1.0.

    Args:
        vector_a, vector_b: sparse vectors as dict term -> weight.

    Returns:
        float. 1.0 means they point in exactly the same direction; 0.0 means they
        share no terms at all.

    WHY COSINE RATHER THAN A PLAIN DOT PRODUCT:
    The dot product alone rewards long documents, because more terms means more
    products to add up -- the very length bias that dividing by word count fixed
    inside tf. Dividing by both magnitudes cancels length out completely, so what
    is left measures only the ANGLE between the vectors: are these two about the
    same things, regardless of how much either one says.

        cos = (a . b) / (|a| * |b|)
    """
    # Iterate the SMALLER vector and look up in the larger. A query has a handful
    # of terms while a page has hundreds, so this turns a scan of the page's
    # whole vocabulary into a scan of the query's few words.
    if len(vector_a) > len(vector_b):
        vector_a, vector_b = vector_b, vector_a

    dot_product = 0.0
    for term, value in vector_a.items():
        if term in vector_b:
            # Terms missing from the other vector contribute value * 0 = 0, so
            # they are skipped rather than added.
            dot_product += value * vector_b[term]

    magnitude_a = vector_magnitude(vector_a)
    magnitude_b = vector_magnitude(vector_b)

    if magnitude_a == 0.0 or magnitude_b == 0.0:
        # An empty page, or a query made entirely of unknown words. Similarity is
        # strictly undefined, but 0.0 is the useful answer -- it simply does not
        # match -- and returning it avoids a ZeroDivisionError mid-search.
        return 0.0

    return dot_product / (magnitude_a * magnitude_b)


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

    # -------------------------------------------------------------------------
    # Step 4 (Checkpoint 10): IDF -- how rare is each word across the corpus?
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("STEP 4  --  compute_idf(): rare words score high, common words near zero")
    print("-" * 70)

    idf = compute_idf(tokenised_documents)
    document_frequency = compute_df(tokenised_documents)

    print("\n  {0} documents in the corpus.\n".format(len(SAMPLE_DOCUMENTS)))
    print("    {0:<14} {1:>8} {2:>10}".format("term", "in docs", "idf"))
    print("    " + "-" * 34)
    for term in sorted(idf, key=lambda k: (-idf[k], k)):
        print("    {0:<14} {1:>8} {2:>10.4f}"
              .format(term, document_frequency[term], idf[term]))

    print("\n  Read the extremes. Words in only one document score highest -- they")
    print("  identify that document. Words in all three go slightly negative, so")
    print("  they pull a match down rather than propping it up.")

    # -------------------------------------------------------------------------
    # Step 5: TF-IDF vectors -- tf and idf multiplied together.
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("STEP 5  --  build_tfidf_vector(): tf x idf, per document")
    print("-" * 70)

    vectors = {}
    for document_id, tokens in tokenised_documents.items():
        vectors[document_id] = build_tfidf_vector(tokens, idf)
        ranked = sorted(vectors[document_id].items(),
                        key=lambda pair: (-pair[1], pair[0]))
        print("\n  {0} -- strongest terms:".format(document_id))
        for term, weight in ranked[:4]:
            print("      {0:<14} {1:>9.4f}".format(term, weight))

    # -------------------------------------------------------------------------
    # Step 6: cosine similarity, document-to-document and query-to-document.
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("STEP 6  --  cosine_similarity(): how alike are two vectors?")
    print("-" * 70)

    document_ids = sorted(vectors)
    print("\n  Document against document:\n")
    print("    {0:<8}".format("") + "".join("{0:>10}".format(d) for d in document_ids))
    for row_id in document_ids:
        cells = "".join(
            "{0:>10.4f}".format(cosine_similarity(vectors[row_id], vectors[col_id]))
            for col_id in document_ids)
        print("    {0:<8}{1}".format(row_id, cells))

    print("\n  The diagonal is 1.0000 -- every document is identical to itself,")
    print("  which is the simplest possible check that the maths is right.")

    SAMPLE_QUERIES = ["pagerank links", "web page", "search relevance"]

    print("\n  Query against documents:\n")
    for query in SAMPLE_QUERIES:
        query_vector = build_tfidf_vector(tokenize(query), idf)
        scored = [(document_id, cosine_similarity(query_vector, vector))
                  for document_id, vector in vectors.items()]
        scored.sort(key=lambda pair: (-pair[1], pair[0]))

        print("    query: {0!r}".format(query))
        for document_id, score in scored:
            bar = "#" * int(round(score * 30))
            print("      {0:<6} {1:>8.4f}  {2}".format(document_id, score, bar))
        print()

    print("  Next checkpoint (12): the SearchEngine class combines this relevance")
    print("  score with each page's PageRank, so a result has to be both on-topic")
    print("  and well-linked to rank highly.")
    print("=" * 70)
