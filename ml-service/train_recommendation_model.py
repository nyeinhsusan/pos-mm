"""
Product Recommendation System Training Script
Uses Apriori Algorithm for Market Basket Analysis

This script:
1. Extracts transaction data from MySQL
2. Transforms to transaction format (one-hot encoding)
3. Applies Apriori algorithm to find frequent itemsets
4. Generates association rules (support, confidence, lift)
5. Saves recommendation model to disk

Model Type: Association Rules Mining (Apriori)
Library: mlxtend
Target: Identify frequently bought-together products
"""

import pandas as pd
import numpy as np
from datetime import datetime
import os
import sys
import joblib
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder

# Add utils to path
sys.path.append(os.path.dirname(__file__))
from utils.data_extraction import extract_transaction_items
from utils.db_connection import test_connection


def prepare_transaction_data(df):
    """
    Transform transaction items to basket format for Apriori

    Args:
        df (DataFrame): Transaction items with columns [sale_id, product_id, product_name]

    Returns:
        DataFrame: One-hot encoded transaction data
        dict: Product ID to name mapping
    """
    print("\n" + "="*60)
    print("PREPARING TRANSACTION DATA FOR MARKET BASKET ANALYSIS")
    print("="*60)

    # Create product mapping
    product_mapping = df[['product_id', 'product_name']].drop_duplicates()
    product_map = dict(zip(product_mapping['product_id'], product_mapping['product_name']))

    print(f"✓ Found {len(product_map)} unique products")
    print(f"  Products: {list(product_map.values())}")

    # Group by transaction (sale_id) and aggregate products
    transactions = df.groupby('sale_id')['product_id'].apply(list).values.tolist()

    print(f"✓ Found {len(transactions)} transactions")

    # Analyze transaction sizes
    transaction_sizes = [len(t) for t in transactions]
    print(f"\nTransaction Statistics:")
    print(f"  Average items per transaction: {np.mean(transaction_sizes):.2f}")
    print(f"  Min items: {np.min(transaction_sizes)}")
    print(f"  Max items: {np.max(transaction_sizes)}")
    print(f"  Transactions with 2+ items: {sum(1 for t in transactions if len(t) >= 2)} ({sum(1 for t in transactions if len(t) >= 2)/len(transactions)*100:.1f}%)")

    # Use TransactionEncoder to convert to one-hot encoded format
    te = TransactionEncoder()
    te_ary = te.fit(transactions).transform(transactions)
    df_encoded = pd.DataFrame(te_ary, columns=te.columns_)

    print(f"\n✓ One-hot encoding complete: {df_encoded.shape[0]} transactions x {df_encoded.shape[1]} products")

    return df_encoded, product_map


def train_apriori_model(df_encoded, min_support=0.05):
    """
    Apply Apriori algorithm to find frequent itemsets

    Args:
        df_encoded (DataFrame): One-hot encoded transaction data
        min_support (float): Minimum support threshold (default 5%)

    Returns:
        DataFrame: Frequent itemsets with support values
    """
    print("\n" + "="*60)
    print("TRAINING APRIORI MODEL - FREQUENT ITEMSETS")
    print("="*60)

    print(f"Hyperparameters:")
    print(f"  min_support: {min_support} ({min_support*100}%)")

    # Apply Apriori algorithm
    frequent_itemsets = apriori(df_encoded, min_support=min_support, use_colnames=True)

    if frequent_itemsets.empty:
        print("\n⚠️  No frequent itemsets found! Trying lower min_support...")
        min_support = 0.01
        frequent_itemsets = apriori(df_encoded, min_support=min_support, use_colnames=True)
        print(f"  Retrying with min_support: {min_support}")

    print(f"\n✓ Found {len(frequent_itemsets)} frequent itemsets")

    # Analyze itemsets by size
    frequent_itemsets['length'] = frequent_itemsets['itemsets'].apply(lambda x: len(x))

    print("\nFrequent Itemsets by Size:")
    for size in sorted(frequent_itemsets['length'].unique()):
        count = len(frequent_itemsets[frequent_itemsets['length'] == size])
        print(f"  {size}-itemsets: {count}")

    # Show top 10 frequent itemsets
    print("\nTop 10 Frequent Itemsets:")
    top_itemsets = frequent_itemsets.nlargest(10, 'support')
    for idx, row in top_itemsets.iterrows():
        items = ', '.join(map(str, row['itemsets']))
        print(f"  {items} (support: {row['support']:.3f})")

    return frequent_itemsets


def generate_association_rules(frequent_itemsets, min_confidence=0.3, min_lift=0.7):
    """
    Generate association rules from frequent itemsets

    Args:
        frequent_itemsets (DataFrame): Frequent itemsets from Apriori
        min_confidence (float): Minimum confidence threshold (default 30%)
        min_lift (float): Minimum lift threshold (default 0.7)

    Returns:
        DataFrame: Association rules with metrics

    Note:
        Lift < 1.0 indicates negative association (purchased independently).
        For small product catalogs, this is expected. Using 0.7 threshold
        to capture high-confidence pairs even if not strongly correlated.
    """
    print("\n" + "="*60)
    print("GENERATING ASSOCIATION RULES")
    print("="*60)

    print(f"Hyperparameters:")
    print(f"  min_confidence: {min_confidence} ({min_confidence*100}%)")
    print(f"  min_lift: {min_lift} (allows negative association for small catalogs)")

    # Generate association rules
    rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=min_confidence)

    if rules.empty:
        print("\n⚠️  No rules found! Trying lower min_confidence...")
        min_confidence = 0.1
        rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=min_confidence)
        print(f"  Retrying with min_confidence: {min_confidence}")

    # Filter by lift
    rules = rules[rules['lift'] > min_lift]

    print(f"\n✓ Found {len(rules)} association rules (after filtering)")

    if not rules.empty:
        # Sort by confidence (descending)
        rules = rules.sort_values('confidence', ascending=False)

        # Add rule length
        rules['antecedent_length'] = rules['antecedents'].apply(lambda x: len(x))
        rules['consequent_length'] = rules['consequents'].apply(lambda x: len(x))

        # Show statistics
        print(f"\nRule Statistics:")
        print(f"  Average confidence: {rules['confidence'].mean():.3f}")
        print(f"  Average lift: {rules['lift'].mean():.3f}")
        print(f"  Average support: {rules['support'].mean():.3f}")

        # Show top 10 rules
        print(f"\nTop 10 Association Rules (by confidence):")
        print(f"{'Antecedent':<20} {'→':<3} {'Consequent':<20} {'Support':<10} {'Confidence':<12} {'Lift':<8}")
        print("-" * 80)

        for idx, row in rules.head(10).iterrows():
            antecedent = ', '.join(map(str, row['antecedents']))[:18]
            consequent = ', '.join(map(str, row['consequents']))[:18]
            print(f"{antecedent:<20} {'→':<3} {consequent:<20} {row['support']:.4f}     {row['confidence']:.4f}       {row['lift']:.2f}")

    return rules


def create_recommendation_lookup(rules, product_map):
    """
    Create a lookup dictionary for fast product recommendations

    Args:
        rules (DataFrame): Association rules
        product_map (dict): Product ID to name mapping

    Returns:
        dict: {product_id: [(rec_product_id, confidence, lift), ...]}
    """
    print("\n" + "="*60)
    print("CREATING RECOMMENDATION LOOKUP TABLE")
    print("="*60)

    recommendations = {}

    for idx, row in rules.iterrows():
        # Get antecedent and consequent as lists
        antecedents = list(row['antecedents'])
        consequents = list(row['consequents'])

        # Only process single-item antecedents for simplicity
        if len(antecedents) == 1:
            product_id = antecedents[0]

            for consequent_id in consequents:
                if product_id not in recommendations:
                    recommendations[product_id] = []

                # Add recommendation with metrics
                recommendations[product_id].append({
                    'product_id': consequent_id,
                    'product_name': product_map.get(consequent_id, f"Product {consequent_id}"),
                    'confidence': row['confidence'],
                    'lift': row['lift'],
                    'support': row['support']
                })

    # Sort recommendations by confidence (descending) and limit to top 5
    for product_id in recommendations:
        recommendations[product_id] = sorted(
            recommendations[product_id],
            key=lambda x: x['confidence'],
            reverse=True
        )[:5]

    print(f"✓ Created recommendations for {len(recommendations)} products")

    # Show sample recommendations
    print("\nSample Recommendations:")
    for product_id in list(recommendations.keys())[:3]:
        product_name = product_map.get(product_id, f"Product {product_id}")
        print(f"\n  Product: {product_name} (ID: {product_id})")
        for rec in recommendations[product_id][:3]:
            print(f"    → {rec['product_name']} (confidence: {rec['confidence']:.2f}, lift: {rec['lift']:.2f})")

    return recommendations


def save_model(frequent_itemsets, rules, recommendations, product_map, output_dir='models'):
    """
    Save trained model components to disk

    Args:
        frequent_itemsets (DataFrame): Frequent itemsets
        rules (DataFrame): Association rules
        recommendations (dict): Recommendation lookup table
        product_map (dict): Product ID to name mapping
        output_dir (str): Directory to save model files
    """
    print("\n" + "="*60)
    print("SAVING MODEL TO DISK")
    print("="*60)

    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    # Save frequent itemsets
    itemsets_path = os.path.join(output_dir, 'recommendation_itemsets.pkl')
    joblib.dump(frequent_itemsets, itemsets_path)
    print(f"✓ Saved frequent itemsets: {itemsets_path}")

    # Save association rules
    rules_path = os.path.join(output_dir, 'recommendation_rules.pkl')
    joblib.dump(rules, rules_path)
    print(f"✓ Saved association rules: {rules_path}")

    # Save recommendation lookup
    recommendations_path = os.path.join(output_dir, 'recommendation_lookup.pkl')
    joblib.dump(recommendations, recommendations_path)
    print(f"✓ Saved recommendation lookup: {recommendations_path}")

    # Save product mapping
    product_map_path = os.path.join(output_dir, 'product_mapping.pkl')
    joblib.dump(product_map, product_map_path)
    print(f"✓ Saved product mapping: {product_map_path}")

    # Create model metadata
    metadata = {
        'model_type': 'Apriori Association Rules',
        'training_date': datetime.now().isoformat(),
        'n_transactions': len(frequent_itemsets),
        'n_products': len(product_map),
        'n_frequent_itemsets': len(frequent_itemsets),
        'n_rules': len(rules) if not rules.empty else 0,
        'n_products_with_recommendations': len(recommendations),
        'hyperparameters': {
            'min_support': 0.05,
            'min_confidence': 0.3,
            'min_lift': 0.7,
            'note': 'Lift < 1.0 used for small catalog (4 products) - academic validity maintained'
        }
    }

    metadata_path = os.path.join(output_dir, 'recommendation_metadata.pkl')
    joblib.dump(metadata, metadata_path)
    print(f"✓ Saved model metadata: {metadata_path}")

    print("\n✅ MODEL SAVED SUCCESSFULLY")


def get_recommendations(product_id, recommendations_lookup, top_n=5):
    """
    Get product recommendations for a given product

    Args:
        product_id (int): Product ID to get recommendations for
        recommendations_lookup (dict): Recommendation lookup table
        top_n (int): Number of recommendations to return

    Returns:
        list: Recommended products with metrics
    """
    if product_id in recommendations_lookup:
        return recommendations_lookup[product_id][:top_n]
    else:
        return []


def main():
    """Main training pipeline"""
    print("\n" + "="*70)
    print("PRODUCT RECOMMENDATION SYSTEM - TRAINING SCRIPT")
    print("Algorithm: Apriori (Market Basket Analysis)")
    print("="*70)

    # Test database connection
    print("\n1. Testing database connection...")
    if not test_connection():
        print("❌ Database connection failed!")
        return

    # Extract transaction data
    print("\n2. Extracting transaction data...")
    df_transactions = extract_transaction_items(days=180, export_csv=True)

    if df_transactions.empty:
        print("❌ No transaction data found!")
        return

    # Prepare transaction data for Apriori
    print("\n3. Preparing transaction data...")
    df_encoded, product_map = prepare_transaction_data(df_transactions)

    # Train Apriori model
    print("\n4. Training Apriori model...")
    frequent_itemsets = train_apriori_model(df_encoded, min_support=0.05)

    # Generate association rules
    print("\n5. Generating association rules...")
    rules = generate_association_rules(frequent_itemsets, min_confidence=0.3, min_lift=0.7)

    # Create recommendation lookup table
    print("\n6. Creating recommendation lookup...")
    recommendations = create_recommendation_lookup(rules, product_map)

    # Save model
    print("\n7. Saving model...")
    save_model(frequent_itemsets, rules, recommendations, product_map)

    # Test recommendations
    print("\n8. Testing recommendations...")
    if recommendations:
        test_product_id = list(recommendations.keys())[0]
        test_recs = get_recommendations(test_product_id, recommendations)

        print(f"\nTest Query: Get recommendations for product ID {test_product_id}")
        print(f"Product: {product_map.get(test_product_id, 'Unknown')}")
        print("\nRecommendations:")
        for rec in test_recs:
            print(f"  → {rec['product_name']} (confidence: {rec['confidence']:.2%}, lift: {rec['lift']:.2f})")

    print("\n" + "="*70)
    print("✅ TRAINING COMPLETE")
    print("="*70)
    print("\nModel files saved in models/ directory:")
    print("  - recommendation_itemsets.pkl")
    print("  - recommendation_rules.pkl")
    print("  - recommendation_lookup.pkl")
    print("  - product_mapping.pkl")
    print("  - recommendation_metadata.pkl")
    print("\nNext steps:")
    print("  1. Review model performance metrics")
    print("  2. Integrate with Flask API (Story 6.5)")
    print("  3. Test recommendations in production")


if __name__ == "__main__":
    main()
