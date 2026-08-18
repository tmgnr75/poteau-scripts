import os
import sys
import stripe

api_key = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_SECRET")
if not api_key:
    sys.exit("Missing STRIPE_SECRET_KEY in the environment. Run:  source ~/.poteau/stripe.env")

# Set your Stripe API key
stripe.api_key = api_key

# Get the product ID
product_id = "prod_GLvwpkWXelREjH"

# List all subscriptions
all_subscriptions = stripe.Subscription.auto_paging_iter()

# Cancel subscriptions associated with the specified product
canceled_count = 0
for subscription in all_subscriptions:
    for item in subscription['items']['data']:
        if item['price']['product'] == product_id:
            stripe.Subscription.modify(subscription.id, cancel_at_period_end=True)
            print(f"Canceled subscription: {subscription.id}")
            canceled_count += 1

print(f"Total subscriptions canceled: {canceled_count}")
