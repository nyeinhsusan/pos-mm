"""
Analyze product associations in transaction data
This script helps understand why no association rules are being generated
"""

import pandas as pd
import sys
import os

sys.path.append(os.path.dirname(__file__))
from utils.data_extraction import extract_transaction_items


def analyze_product_associations():
    """Analyze co-occurrence patterns in transactions"""

    print("="*60)
    print("TRANSACTION ASSOCIATION ANALYSIS")
    print("="*60)

    # Extract transaction data
    df = extract_transaction_items(days=180, export_csv=False)

    if df.empty:
        print("No data found!")
        return

    # Get unique products
    products = df[['product_id', 'product_name']].drop_duplicates()
    product_map = dict(zip(products['product_id'], products['product_name']))

    print(f"\nProducts ({len(product_map)}):")
    for pid, pname in product_map.items():
        print(f"  {pid}: {pname}")

    # Group by transaction
    transactions = df.groupby('sale_id')['product_id'].apply(list).reset_index()
    transactions['size'] = transactions['product_id'].apply(len)

    print(f"\nTransaction Statistics:")
    print(f"  Total transactions: {len(transactions)}")
    print(f"  Avg items per transaction: {transactions['size'].mean():.2f}")
    print(f"  Transaction sizes:")
    for size in sorted(transactions['size'].unique()):
        count = len(transactions[transactions['size'] == size])
        pct = count / len(transactions) * 100
        print(f"    {size} items: {count} ({pct:.1f}%)")

    # Analyze all product pairs
    print(f"\nProduct Pair Co-occurrence:")
    print(f"{'Product A':<25} {'Product B':<25} {'Co-occur':<10} {'% of Trans':<12}")
    print("-" * 80)

    pair_counts = {}
    total_trans = len(transactions)

    # Count co-occurrences
    for _, row in transactions.iterrows():
        products_in_trans = row['product_id']
        if len(products_in_trans) >= 2:
            # Get all pairs
            for i in range(len(products_in_trans)):
                for j in range(i+1, len(products_in_trans)):
                    pair = tuple(sorted([products_in_trans[i], products_in_trans[j]]))
                    pair_counts[pair] = pair_counts.get(pair, 0) + 1

    # Sort by frequency
    sorted_pairs = sorted(pair_counts.items(), key=lambda x: x[1], reverse=True)

    for pair, count in sorted_pairs:
        prod_a = product_map.get(pair[0], f"Product {pair[0]}")
        prod_b = product_map.get(pair[1], f"Product {pair[1]}")
        pct = count / total_trans * 100
        print(f"{prod_a:<25} {prod_b:<25} {count:<10} {pct:<12.2f}%")

    # Calculate conditional probabilities
    print(f"\nConditional Probabilities (Confidence):")
    print(f"If buying Product A, probability of also buying Product B:")
    print(f"{'Product A':<25} {'Product B':<25} {'P(B|A)':<10} {'Support':<10}")
    print("-" * 80)

    # Count individual product occurrences
    product_counts = {}
    for _, row in transactions.iterrows():
        for pid in row['product_id']:
            product_counts[pid] = product_counts.get(pid, 0) + 1

    # Calculate confidence for each pair
    confidences = []
    for pair, pair_count in sorted_pairs:
        prod_a, prod_b = pair

        # Confidence A → B
        conf_a_to_b = pair_count / product_counts[prod_a]
        support = pair_count / total_trans

        confidences.append({
            'antecedent': prod_a,
            'consequent': prod_b,
            'confidence': conf_a_to_b,
            'support': support
        })

        # Confidence B → A
        conf_b_to_a = pair_count / product_counts[prod_b]

        confidences.append({
            'antecedent': prod_b,
            'consequent': prod_a,
            'confidence': conf_b_to_a,
            'support': support
        })

    # Sort by confidence
    confidences = sorted(confidences, key=lambda x: x['confidence'], reverse=True)

    for item in confidences:
        prod_a_name = product_map.get(item['antecedent'], f"Product {item['antecedent']}")
        prod_b_name = product_map.get(item['consequent'], f"Product {item['consequent']}")
        print(f"{prod_a_name:<25} {prod_b_name:<25} {item['confidence']:<10.3f} {item['support']:<10.3f}")

    # Calculate lift
    print(f"\nLift Analysis:")
    print(f"{'Product A':<25} {'Product B':<25} {'Lift':<10}")
    print("-" * 80)

    lifts = []
    for pair, pair_count in sorted_pairs:
        prod_a, prod_b = pair

        # P(A and B)
        p_ab = pair_count / total_trans

        # P(A) * P(B)
        p_a = product_counts[prod_a] / total_trans
        p_b = product_counts[prod_b] / total_trans

        # Lift = P(A and B) / (P(A) * P(B))
        lift = p_ab / (p_a * p_b) if (p_a * p_b) > 0 else 0

        lifts.append({
            'prod_a': prod_a,
            'prod_b': prod_b,
            'lift': lift
        })

    # Sort by lift
    lifts = sorted(lifts, key=lambda x: x['lift'], reverse=True)

    for item in lifts:
        prod_a_name = product_map.get(item['prod_a'], f"Product {item['prod_a']}")
        prod_b_name = product_map.get(item['prod_b'], f"Product {item['prod_b']}")
        print(f"{prod_a_name:<25} {prod_b_name:<25} {item['lift']:<10.3f}")

    print(f"\n" + "="*60)
    print("ANALYSIS COMPLETE")
    print("="*60)


if __name__ == "__main__":
    analyze_product_associations()
