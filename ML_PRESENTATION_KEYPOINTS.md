# ML Presentation Key Points (15 min)

---

## 1. SALES FORECASTING (SARIMAX)

**What it does:** Predicts future daily sales (7/14/30 days)
**How it works:** Learns from past sales patterns (weekly + monthly) and projects forward using statistics
**Accuracy:** 26% MAPE (standard for retail)


## 2. INVENTORY PREDICTION (Random Forest)

**What it does:** Predicts when stock runs out and how much to reorder
**How it works:** Days until stockout = Current Stock ÷ Daily Sales Velocity
**Accuracy:** 99.99% (formula-based, nearly perfect)


## 3. PRODUCT RECOMMENDATIONS (Apriori)
**What it does:** Suggests frequently bought-together products
**How it works:**
- Analyzes 2,662 transaction records
- Finds products that appear together frequently
- Generates association rules (if A, then B)
- When customer buys product → show related products

**Metrics:**
- Support: How often products bought together
- Confidence: Probability of follow-up purchase
- Lift: How much more likely than random

**Coverage:** 100% (all products have recommendations)


## TECHNICAL SUMMARY

| Feature | Algorithm | Data Required | Accuracy |
|---------|-----------|---------------|----------|
| Sales Forecast | SARIMAX | 180 days daily sales | MAPE 26% |
| Inventory | Random Forest | Stock + velocity | 99.99% |
| Recommendations | Apriori | 2,662 transactions | 100% |

**Stack:** Python ML → Flask API → Node.js → React → MySQL → Azure

**Why these models:**
- Time series → SARIMAX (handles seasonality)
- Regression → Random Forest (robust, interpretable)
- Market basket → Apriori (classic, proven)
Used to identify trends, such as in market basket analysis to determine which items are often bought together.
---

## KEY MESSAGE

"Three practical ML features for Myanmar SME retail:
1. Budget planning via sales forecasting
2. Stockout prevention via inventory prediction
3. Sales increase via product recommendations"

---

## LIKELY Q&A ANSWERS

A: Standard for retail. Need 1-2 years data for better accuracy.
A: Deterministic math (stock ÷ velocity = days). Expected result.
A: 6 months sales history, inventory records, transactions.

All models are integrated into a full-stack POS system and deployed to Azure cloud. The key learning: ML doesn't need to be complex to be useful - even simple models provide significant business value."
"I developed a Point of Sale system with integrated Machine Learning capabilities for Myanmar small businesses. The system includes three AI features:
1. **Sales Forecasting** - predicts future sales (7/14/30 days)
2. **Inventory Prediction** - predicts when products will run out
3. **Product Recommendations** - suggests frequently bought-together items

**Why Machine Learning?**
- Myanmar SMEs often rely on guesswork for inventory
- Stockouts cause lost sales; overstocking ties up capital
- ML automates decisions that owners make manually

## POSSIBLE Q&A PREPARATION:

**Q: Why is forecast accuracy only 26%? Isn't that low?**
A: 20-30% MAPE is standard in retail forecasting. With only 6 months of data, seasonal patterns aren't fully established. More data = better accuracy.

**Q: Why is inventory prediction 99.99%? Is that real?**
A: Yes! The relationship (stock ÷ velocity = days) is deterministic. The model just automates this calculation.

**Q: What data do you need?**
A: 6 months of daily sales history, product inventory levels, and transaction records.

**Q: Can this work for bigger businesses?**
A: Yes! The architecture scales. Would need more data and larger product catalogs for enterprise use.

