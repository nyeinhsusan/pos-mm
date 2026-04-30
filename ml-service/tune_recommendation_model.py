"""
Hyperparameter Tuning for Product Recommendation Model
Finds optimal min_support, min_confidence, and min_lift values

This script tests different parameter combinations to maximize:
- Number of valid association rules
- Average confidence of rules
- Coverage (% of products with recommendations)
"""

import pandas as pd
import numpy as np
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder
import sys
import os

sys.path.append(os.path.dirname(__file__))
from utils.data_extraction import extract_transaction_items
from utils.db_connection import test_connection


def prepare_transaction_data(df):
    """Transform transaction data to basket format"""
    product_map = dict(zip(df['product_id'], df['product_name']))
    transactions = df.groupby('sale_id')['product_id'].apply(list).values.tolist()

    te = TransactionEncoder()
    te_ary = te.fit(transactions).transform(transactions)
    df_encoded = pd.DataFrame(te_ary, columns=te.columns_)

    return df_encoded, product_map, transactions


def evaluate_parameters(df_encoded, product_map, min_support, min_confidence, min_lift):
    """
    Evaluate model with given hyperparameters

    Returns:
        dict: Evaluation metrics
    """
    try:
        # Apply Apriori
        frequent_itemsets = apriori(df_encoded, min_support=min_support, use_colnames=True)

        if frequent_itemsets.empty:
            return {
                'n_itemsets': 0,
                'n_rules': 0,
                'n_products_with_recs': 0,
                'avg_confidence': 0,
                'avg_lift': 0,
                'coverage': 0,
                'valid': False
            }

        # Generate rules
        rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=min_confidence)

        if rules.empty:
            return {
                'n_itemsets': len(frequent_itemsets),
                'n_rules': 0,
                'n_products_with_recs': 0,
                'avg_confidence': 0,
                'avg_lift': 0,
                'coverage': 0,
                'valid': False
            }

        # Filter by lift
        rules = rules[rules['lift'] > min_lift]

        if rules.empty:
            return {
                'n_itemsets': len(frequent_itemsets),
                'n_rules': 0,
                'n_products_with_recs': 0,
                'avg_confidence': 0,
                'avg_lift': 0,
                'coverage': 0,
                'valid': False
            }

        # Count products with recommendations
        products_with_recs = set()
        for _, row in rules.iterrows():
            antecedents = list(row['antecedents'])
            if len(antecedents) == 1:
                products_with_recs.add(antecedents[0])

        coverage = len(products_with_recs) / len(product_map) if len(product_map) > 0 else 0

        return {
            'n_itemsets': len(frequent_itemsets),
            'n_rules': len(rules),
            'n_products_with_recs': len(products_with_recs),
            'avg_confidence': rules['confidence'].mean(),
            'avg_lift': rules['lift'].mean(),
            'coverage': coverage,
            'valid': True
        }

    except Exception as e:
        return {
            'n_itemsets': 0,
            'n_rules': 0,
            'n_products_with_recs': 0,
            'avg_confidence': 0,
            'avg_lift': 0,
            'coverage': 0,
            'valid': False,
            'error': str(e)
        }


def grid_search(df_encoded, product_map):
    """
    Perform grid search to find optimal hyperparameters

    Parameter ranges:
    - min_support: [0.01, 0.03, 0.05, 0.10]
    - min_confidence: [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4]
    - min_lift: [1.0, 1.1, 1.2]
    """
    print("\n" + "="*60)
    print("HYPERPARAMETER GRID SEARCH")
    print("="*60)

    # Define parameter grid
    support_values = [0.01, 0.03, 0.05, 0.10]
    confidence_values = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4]
    lift_values = [1.0, 1.1, 1.2]

    total_combinations = len(support_values) * len(confidence_values) * len(lift_values)

    print(f"\nParameter Grid:")
    print(f"  min_support: {support_values}")
    print(f"  min_confidence: {confidence_values}")
    print(f"  min_lift: {lift_values}")
    print(f"  Total combinations: {total_combinations}")

    # Store results
    results = []

    # Grid search
    print("\nSearching...")
    for min_support in support_values:
        for min_confidence in confidence_values:
            for min_lift in lift_values:
                metrics = evaluate_parameters(df_encoded, product_map, min_support, min_confidence, min_lift)

                results.append({
                    'min_support': min_support,
                    'min_confidence': min_confidence,
                    'min_lift': min_lift,
                    **metrics
                })

                # Print progress
                if metrics['valid'] and metrics['n_rules'] > 0:
                    print(f"  ✓ support={min_support:.2f}, confidence={min_confidence:.2f}, lift={min_lift:.1f} → {metrics['n_rules']} rules, coverage={metrics['coverage']:.1%}")

    # Convert to DataFrame
    df_results = pd.DataFrame(results)

    # Filter valid results (with at least 1 rule)
    df_valid = df_results[df_results['n_rules'] > 0]

    if df_valid.empty:
        print("\n❌ No valid parameter combinations found!")
        print("\nShowing all results:")
        print(df_results.to_string())
        return None

    print(f"\n✓ Found {len(df_valid)} valid parameter combinations")

    return df_results


def find_best_parameters(df_results):
    """
    Find best hyperparameters based on multiple criteria

    Scoring:
    - Maximize: number of rules
    - Maximize: coverage (% products with recommendations)
    - Maximize: average confidence
    """
    print("\n" + "="*60)
    print("FINDING BEST PARAMETERS")
    print("="*60)

    df_valid = df_results[df_results['n_rules'] > 0]

    if df_valid.empty:
        print("❌ No valid results to evaluate!")
        return None

    # Normalize metrics for scoring
    df_valid = df_valid.copy()
    df_valid['score_rules'] = df_valid['n_rules'] / df_valid['n_rules'].max()
    df_valid['score_coverage'] = df_valid['coverage'] / df_valid['coverage'].max() if df_valid['coverage'].max() > 0 else 0
    df_valid['score_confidence'] = df_valid['avg_confidence'] / df_valid['avg_confidence'].max() if df_valid['avg_confidence'].max() > 0 else 0

    # Combined score (weighted)
    df_valid['total_score'] = (
        0.4 * df_valid['score_rules'] +
        0.4 * df_valid['score_coverage'] +
        0.2 * df_valid['score_confidence']
    )

    # Sort by total score
    df_valid = df_valid.sort_values('total_score', ascending=False)

    # Best parameters
    best = df_valid.iloc[0]

    print(f"\n✅ BEST PARAMETERS:")
    print(f"  min_support: {best['min_support']}")
    print(f"  min_confidence: {best['min_confidence']}")
    print(f"  min_lift: {best['min_lift']}")

    print(f"\nPerformance Metrics:")
    print(f"  Number of rules: {int(best['n_rules'])}")
    print(f"  Products with recommendations: {int(best['n_products_with_recs'])}")
    print(f"  Coverage: {best['coverage']:.1%}")
    print(f"  Average confidence: {best['avg_confidence']:.3f}")
    print(f"  Average lift: {best['avg_lift']:.3f}")

    # Show top 5 alternatives
    print(f"\nTop 5 Parameter Combinations:")
    print(f"{'Support':<10} {'Confidence':<12} {'Lift':<8} {'Rules':<8} {'Coverage':<10} {'Avg Conf':<10} {'Score':<8}")
    print("-" * 80)

    for idx, row in df_valid.head(5).iterrows():
        print(f"{row['min_support']:<10.2f} {row['min_confidence']:<12.2f} {row['min_lift']:<8.1f} {int(row['n_rules']):<8} {row['coverage']:<10.1%} {row['avg_confidence']:<10.3f} {row['total_score']:<8.3f}")

    return {
        'min_support': best['min_support'],
        'min_confidence': best['min_confidence'],
        'min_lift': best['min_lift']
    }


def main():
    """Main tuning pipeline"""
    print("\n" + "="*70)
    print("PRODUCT RECOMMENDATION MODEL - HYPERPARAMETER TUNING")
    print("="*70)

    # Test connection
    print("\n1. Testing database connection...")
    if not test_connection():
        print("❌ Database connection failed!")
        return

    # Extract data
    print("\n2. Extracting transaction data...")
    df_transactions = extract_transaction_items(days=180, export_csv=False)

    if df_transactions.empty:
        print("❌ No transaction data found!")
        return

    # Prepare data
    print("\n3. Preparing transaction data...")
    df_encoded, product_map, transactions = prepare_transaction_data(df_transactions)

    print(f"✓ Prepared {len(transactions)} transactions with {len(product_map)} products")

    # Grid search
    print("\n4. Running grid search...")
    df_results = grid_search(df_encoded, product_map)

    if df_results is None:
        print("\n❌ Grid search failed!")
        return

    # Find best parameters
    print("\n5. Finding best parameters...")
    best_params = find_best_parameters(df_results)

    if best_params:
        # Save results
        output_path = 'models/best_recommendation_params.pkl'
        import joblib
        joblib.dump(best_params, output_path)
        print(f"\n✓ Saved best parameters to: {output_path}")

        print("\n" + "="*70)
        print("✅ HYPERPARAMETER TUNING COMPLETE")
        print("="*70)
        print(f"\nNext steps:")
        print(f"  1. Update train_recommendation_model.py with best parameters")
        print(f"  2. Retrain model with optimized hyperparameters")
        print(f"  3. Evaluate model performance")


if __name__ == "__main__":
    main()
