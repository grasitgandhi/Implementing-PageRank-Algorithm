"""
===============================================================================
 tests/test_search_stats_modules.py  --  Tests for search and statistics
===============================================================================

 PROJECT      : Implementing PageRank Algorithm (Group 81, TE Sem V Mini Project I)
 AUTHOR       : Rudraksh Shah (2024300214)
 CHECKPOINT   : 13 (Days 59-63)
 COVERS       : search_engine.py, stats_analysis.py
 SRS MAPPING  : FR5.1-FR5.4, NFR8, NFR9

 PURPOSE
 -------
 The headline test is the one the checkpoint asks for by name: a query identical
 to a document's own text must score that document highest in the corpus. It is
 the sanity check that matters most, because if searching a document's exact
 words does not find that document, nothing else about the ranking is worth
 discussing.

 The statistics tests check mean, variance and standard deviation against values
 worked out by hand on a fixed list, so a wrong formula is caught by arithmetic
 rather than by the numbers merely looking plausible.

 HOW TO RUN
 ----------
     python tests/test_search_stats_modules.py      (from the project root)

 Prints ALL TESTS PASSED at the end if everything holds. Needs no network.
===============================================================================
"""

import os
import sys

# The modules under test live one directory up. See the equivalent note in
# tests/test_math_modules.py about `sys` being the one module used beyond the
# project's agreed library list, and only in test files.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import search_engine
import stats_analysis


TOLERANCE = 1e-9


def almost_equal(actual, expected, tolerance=TOLERANCE):
    """True if two floats agree within tolerance. Floats are never compared with ==."""
    return abs(actual - expected) < tolerance


# A small corpus with deliberately distinct subjects, so each document has terms
# the others lack and the relevance scores have something to separate them on.
CORPUS = {
    "pagerank": "PageRank ranks web pages using the link structure of the web",
    "hyperlink": "A hyperlink is a reference from one document to another document",
    "statistics": "Variance measures how far numbers spread out from their mean",
    "crawler": "A crawler fetches pages over sockets and follows their links",
}


# =============================================================================
# search_engine.py  --  tokenising and term frequency
# =============================================================================

def test_tokenize_lowercases_and_drops_punctuation():
    """'PageRank ranks pages.' must become three clean lowercase tokens."""
    tokens = search_engine.tokenize("PageRank ranks pages.")

    assert tokens == ["pagerank", "ranks", "pages"], \
        "unexpected tokens: {0!r}".format(tokens)
    print("PASS  test_tokenize_lowercases_and_drops_punctuation")


def test_tokenize_lowercases_before_matching():
    """Capitalised words must survive. Matching before lowercasing would drop them.

    Every sentence starts with a capital, so getting this order wrong would
    silently discard a large share of the corpus.
    """
    tokens = search_engine.tokenize("THE Quick BROWN fox")

    assert tokens == ["the", "quick", "brown", "fox"], \
        "capitalised words were lost: {0!r}".format(tokens)
    print("PASS  test_tokenize_lowercases_before_matching")


def test_tokenize_keeps_digits():
    """Years and version numbers are meaningful query terms."""
    tokens = search_engine.tokenize("PageRank 1998 HTTP/1.1")

    assert "1998" in tokens, "digits were dropped: {0!r}".format(tokens)
    assert "1" in tokens, "version digits were dropped: {0!r}".format(tokens)
    print("PASS  test_tokenize_keeps_digits")


def test_tokenize_of_empty_text_is_empty():
    """Empty and punctuation-only input must give an empty list, not a crash."""
    assert search_engine.tokenize("") == []
    assert search_engine.tokenize("!!! ... ???") == []
    print("PASS  test_tokenize_of_empty_text_is_empty")


def test_term_frequency_matches_the_hand_calculation():
    """'a' appears 3 times in 4 tokens, so tf must be exactly 0.75."""
    term_frequencies = search_engine.compute_tf(["a", "b", "a", "a"])

    assert almost_equal(term_frequencies["a"], 0.75), \
        "expected 0.75, got {0!r}".format(term_frequencies["a"])
    assert almost_equal(term_frequencies["b"], 0.25), \
        "expected 0.25, got {0!r}".format(term_frequencies["b"])
    print("PASS  test_term_frequency_matches_the_hand_calculation")


def test_term_frequencies_sum_to_one():
    """Every tf table is a proportion of the document, so it must total 1.0."""
    tokens = search_engine.tokenize(CORPUS["pagerank"])
    total = sum(search_engine.compute_tf(tokens).values())

    assert almost_equal(total, 1.0), "tf values sum to {0!r}, not 1.0".format(total)
    print("PASS  test_term_frequencies_sum_to_one")


def test_term_frequency_of_empty_document_is_empty():
    """An empty page must give {} rather than dividing by zero."""
    assert search_engine.compute_tf([]) == {}
    print("PASS  test_term_frequency_of_empty_document_is_empty")


# =============================================================================
# search_engine.py  --  IDF and cosine similarity
# =============================================================================

def test_rare_terms_score_higher_than_common_ones():
    """IDF must rank a one-document term above a term present everywhere."""
    tokenised = {name: search_engine.tokenize(text) for name, text in CORPUS.items()}
    idf = search_engine.compute_idf(tokenised)

    # "variance" appears in one document; "pages" appears in several.
    assert idf["variance"] > idf["pages"], \
        "a rare term should outweigh a common one: variance {0!r} vs pages {1!r}".format(
            idf["variance"], idf["pages"])
    print("PASS  test_rare_terms_score_higher_than_common_ones")


def test_identical_vectors_are_perfectly_similar():
    """A document compared with itself must score exactly 1.0."""
    tokenised = {name: search_engine.tokenize(text) for name, text in CORPUS.items()}
    idf = search_engine.compute_idf(tokenised)
    vector = search_engine.build_tfidf_vector(tokenised["pagerank"], idf)

    similarity = search_engine.cosine_similarity(vector, vector)

    assert almost_equal(similarity, 1.0), \
        "a vector against itself should be 1.0, got {0!r}".format(similarity)
    print("PASS  test_identical_vectors_are_perfectly_similar")


def test_vectors_with_no_shared_terms_score_zero():
    """No overlap means no similarity."""
    similarity = search_engine.cosine_similarity({"alpha": 1.0}, {"beta": 1.0})

    assert almost_equal(similarity, 0.0), \
        "unrelated vectors should score 0.0, got {0!r}".format(similarity)
    print("PASS  test_vectors_with_no_shared_terms_score_zero")


def test_empty_vector_does_not_divide_by_zero():
    """An empty vector returns 0.0 rather than raising ZeroDivisionError."""
    assert search_engine.cosine_similarity({}, {"a": 1.0}) == 0.0
    assert search_engine.cosine_similarity({}, {}) == 0.0
    print("PASS  test_empty_vector_does_not_divide_by_zero")


def test_a_document_is_its_own_best_match():
    """THE headline test: querying a document's exact text must find it first.

    This is the check the checkpoint names explicitly. If searching a page's own
    words does not rank that page top, the relevance scoring is broken and no
    other result from it can be trusted.
    """
    tokenised = {name: search_engine.tokenize(text) for name, text in CORPUS.items()}
    idf = search_engine.compute_idf(tokenised)
    vectors = {name: search_engine.build_tfidf_vector(tokens, idf)
               for name, tokens in tokenised.items()}

    for target_name, target_text in CORPUS.items():
        query_vector = search_engine.build_tfidf_vector(
            search_engine.tokenize(target_text), idf)

        scored = [(name, search_engine.cosine_similarity(query_vector, vector))
                  for name, vector in vectors.items()]
        scored.sort(key=lambda pair: (-pair[1], pair[0]))

        assert scored[0][0] == target_name, \
            "querying {0!r}'s own text ranked {1!r} first".format(target_name, scored[0][0])

    print("PASS  test_a_document_is_its_own_best_match")


# =============================================================================
# search_engine.py  --  the SearchEngine class
# =============================================================================

def build_test_engine():
    """A SearchEngine over the test corpus with deliberately uneven PageRank."""
    pagerank_scores = {
        "pagerank": 0.40,
        "hyperlink": 0.30,
        "crawler": 0.20,
        "statistics": 0.10,
    }
    return search_engine.SearchEngine(CORPUS, pagerank_scores)


def test_results_come_back_sorted_by_final_score():
    """The result list must be ordered best-first (FR5.4)."""
    engine = build_test_engine()
    results = engine.search("web pages link structure")

    assert len(results) > 0, "expected at least one result"
    finals = [row["final"] for row in results]
    assert finals == sorted(finals, reverse=True), \
        "results are not sorted by final score: {0!r}".format(finals)
    print("PASS  test_results_come_back_sorted_by_final_score")


def test_every_result_carries_both_sub_scores():
    """FR5.3: the caller must be able to see relevance and authority separately."""
    engine = build_test_engine()
    results = engine.search("variance mean numbers")

    assert results, "expected a result for a query matching the statistics page"
    for row in results:
        for key in ("page_id", "final", "relevance", "pagerank"):
            assert key in row, "result row is missing {0!r}: {1!r}".format(key, row)
    print("PASS  test_every_result_carries_both_sub_scores")


def test_alpha_of_one_ignores_pagerank_entirely():
    """At alpha = 1.0 the final score must equal the relevance score exactly."""
    engine = build_test_engine()
    results = engine.search("crawler sockets", alpha=1.0)

    assert results, "expected a result"
    for row in results:
        assert almost_equal(row["final"], row["relevance"]), \
            "alpha=1.0 should make final == relevance, got {0!r} vs {1!r}".format(
                row["final"], row["relevance"])
    print("PASS  test_alpha_of_one_ignores_pagerank_entirely")


def test_alpha_of_zero_ignores_relevance_entirely():
    """At alpha = 0.0 the final score must equal the PageRank score exactly."""
    engine = build_test_engine()
    results = engine.search("crawler sockets", alpha=0.0)

    assert results, "expected a result"
    for row in results:
        assert almost_equal(row["final"], row["pagerank"]), \
            "alpha=0.0 should make final == pagerank, got {0!r} vs {1!r}".format(
                row["final"], row["pagerank"])
    print("PASS  test_alpha_of_zero_ignores_relevance_entirely")


def test_query_of_unknown_words_returns_nothing():
    """A query no page can match returns an empty list, not an error."""
    engine = build_test_engine()

    assert engine.search("zzzznonexistentquery") == [], \
        "a query of unknown words should return no results"
    print("PASS  test_query_of_unknown_words_returns_nothing")


def test_limit_is_respected():
    """search(limit=n) must never return more than n rows."""
    engine = build_test_engine()
    results = engine.search("pages document links web", limit=2)

    assert len(results) <= 2, "limit ignored: got {0} rows".format(len(results))
    print("PASS  test_limit_is_respected")


def test_normalise_puts_the_best_score_at_one():
    """normalise() scales by the maximum, so the top entry becomes exactly 1.0."""
    normalised = search_engine.normalise({"a": 2.0, "b": 1.0, "c": 0.5})

    assert almost_equal(normalised["a"], 1.0), "best should be 1.0"
    assert almost_equal(normalised["b"], 0.5), "half the best should be 0.5"
    assert search_engine.normalise({}) == {}, "empty input should give empty output"
    assert search_engine.normalise({"a": 0.0}) == {"a": 0.0}, "all-zero must not divide by zero"
    print("PASS  test_normalise_puts_the_best_score_at_one")


# =============================================================================
# stats_analysis.py
# =============================================================================

# Worked out on paper:
#   mean     = (2+4+4+4+5+5+7+9) / 8 = 40 / 8 = 5.0
#   squared deviations = 9+1+1+1+0+0+4+16 = 32
#   variance = 32 / 8 = 4.0
#   std dev  = sqrt(4.0) = 2.0
HAND_CHECKED = [2, 4, 4, 4, 5, 5, 7, 9]


def test_mean_matches_the_hand_calculation():
    assert almost_equal(stats_analysis.mean(HAND_CHECKED), 5.0), \
        "expected 5.0, got {0!r}".format(stats_analysis.mean(HAND_CHECKED))
    print("PASS  test_mean_matches_the_hand_calculation")


def test_variance_matches_the_hand_calculation():
    assert almost_equal(stats_analysis.variance(HAND_CHECKED), 4.0), \
        "expected 4.0, got {0!r}".format(stats_analysis.variance(HAND_CHECKED))
    print("PASS  test_variance_matches_the_hand_calculation")


def test_std_dev_matches_the_hand_calculation():
    assert almost_equal(stats_analysis.std_dev(HAND_CHECKED), 2.0), \
        "expected 2.0, got {0!r}".format(stats_analysis.std_dev(HAND_CHECKED))
    print("PASS  test_std_dev_matches_the_hand_calculation")


def test_variance_uses_population_not_sample_divisor():
    """Dividing by n, not (n-1). The two differ and the choice is deliberate.

    For [1, 3]: mean 2, squared deviations 1 + 1 = 2.
        population (n)     : 2 / 2 = 1.0     <- what we implement
        sample     (n - 1) : 2 / 1 = 2.0
    """
    assert almost_equal(stats_analysis.variance([1, 3]), 1.0), \
        "variance should divide by n, got {0!r}".format(stats_analysis.variance([1, 3]))
    print("PASS  test_variance_uses_population_not_sample_divisor")


def test_identical_values_have_zero_spread():
    """A list where nothing varies must have variance exactly 0."""
    assert almost_equal(stats_analysis.variance([7, 7, 7, 7]), 0.0)
    assert almost_equal(stats_analysis.std_dev([7, 7, 7, 7]), 0.0)
    print("PASS  test_identical_values_have_zero_spread")


def test_statistics_edge_cases_do_not_crash():
    """Empty and single-value lists return 0.0 rather than raising."""
    assert stats_analysis.mean([]) == 0.0
    assert stats_analysis.variance([]) == 0.0
    assert stats_analysis.variance([5]) == 0.0
    assert stats_analysis.std_dev([]) == 0.0
    print("PASS  test_statistics_edge_cases_do_not_crash")


def test_random_graph_has_the_requested_number_of_pages():
    """G(n, p) must produce exactly n nodes, whatever p happens to be."""
    graph = stats_analysis.erdos_renyi_graph(30, 0.1)

    assert len(graph) == 30, "expected 30 pages, got {0}".format(len(graph))
    print("PASS  test_random_graph_has_the_requested_number_of_pages")


def test_random_graph_at_probability_zero_has_no_edges():
    """p = 0 means no edge ever passes its coin flip."""
    graph = stats_analysis.erdos_renyi_graph(20, 0.0)
    total_edges = sum(len(targets) for targets in graph.values())

    assert total_edges == 0, "p=0 should give no edges, got {0}".format(total_edges)
    print("PASS  test_random_graph_at_probability_zero_has_no_edges")


def test_random_graph_at_probability_one_is_complete():
    """p = 1 means every possible edge exists: n*(n-1), self-links excluded."""
    page_count = 10
    graph = stats_analysis.erdos_renyi_graph(page_count, 1.0)
    total_edges = sum(len(targets) for targets in graph.values())

    expected = page_count * (page_count - 1)
    assert total_edges == expected, \
        "p=1 should give {0} edges, got {1}".format(expected, total_edges)
    print("PASS  test_random_graph_at_probability_one_is_complete")


def test_random_graph_has_no_self_links():
    """A page must never link to itself -- the real crawler filters these too."""
    graph = stats_analysis.erdos_renyi_graph(25, 0.5)

    for page, targets in graph.items():
        assert page not in targets, "{0!r} links to itself".format(page)
    print("PASS  test_random_graph_has_no_self_links")


def test_random_graph_rejects_an_impossible_probability():
    """p outside [0, 1] is not a probability and must be refused."""
    try:
        stats_analysis.erdos_renyi_graph(10, 1.5)
    except ValueError:
        print("PASS  test_random_graph_rejects_an_impossible_probability")
        return
    raise AssertionError("p = 1.5 should have raised ValueError")


def test_random_graph_is_reproducible_with_a_fixed_seed():
    """The same seed must give the identical graph, or no benchmark is repeatable."""
    first = stats_analysis.erdos_renyi_graph(15, 0.3, seed=81)
    second = stats_analysis.erdos_renyi_graph(15, 0.3, seed=81)

    assert first == second, "the same seed produced two different graphs"
    print("PASS  test_random_graph_is_reproducible_with_a_fixed_seed")


if __name__ == "__main__":
    print("=" * 70)
    print("tests/test_search_stats_modules.py")
    print("=" * 70)
    print()

    print("-- search_engine.py: tokenising and tf " + "-" * 29)
    test_tokenize_lowercases_and_drops_punctuation()
    test_tokenize_lowercases_before_matching()
    test_tokenize_keeps_digits()
    test_tokenize_of_empty_text_is_empty()
    test_term_frequency_matches_the_hand_calculation()
    test_term_frequencies_sum_to_one()
    test_term_frequency_of_empty_document_is_empty()

    print("\n-- search_engine.py: idf and cosine " + "-" * 32)
    test_rare_terms_score_higher_than_common_ones()
    test_identical_vectors_are_perfectly_similar()
    test_vectors_with_no_shared_terms_score_zero()
    test_empty_vector_does_not_divide_by_zero()
    test_a_document_is_its_own_best_match()

    print("\n-- search_engine.py: SearchEngine " + "-" * 34)
    test_results_come_back_sorted_by_final_score()
    test_every_result_carries_both_sub_scores()
    test_alpha_of_one_ignores_pagerank_entirely()
    test_alpha_of_zero_ignores_relevance_entirely()
    test_query_of_unknown_words_returns_nothing()
    test_limit_is_respected()
    test_normalise_puts_the_best_score_at_one()

    print("\n-- stats_analysis.py " + "-" * 47)
    test_mean_matches_the_hand_calculation()
    test_variance_matches_the_hand_calculation()
    test_std_dev_matches_the_hand_calculation()
    test_variance_uses_population_not_sample_divisor()
    test_identical_values_have_zero_spread()
    test_statistics_edge_cases_do_not_crash()
    test_random_graph_has_the_requested_number_of_pages()
    test_random_graph_at_probability_zero_has_no_edges()
    test_random_graph_at_probability_one_is_complete()
    test_random_graph_has_no_self_links()
    test_random_graph_rejects_an_impossible_probability()
    test_random_graph_is_reproducible_with_a_fixed_seed()

    print()
    print("=" * 70)
    print("ALL TESTS PASSED")
    print("=" * 70)
