const https = require('https');

const cancelSubscriptionsForProduct = (productId, apiKey) => {
  const listSubscriptionsUrl = 'https://api.stripe.com/v1/subscriptions';

  const listOptions = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  };

  https.get(listSubscriptionsUrl, listOptions, (listResponse) => {
    let data = '';

    listResponse.on('data', (chunk) => {
      data += chunk;
    });

    listResponse.on('end', async () => {
      if (listResponse.statusCode === 200) {
        const subscriptions = JSON.parse(data).data;

        console.log(`Total subscriptions fetched: ${subscriptions.length}`);

        let canceledCount = 0;

        for (const subscription of subscriptions) {
          if (subscription.items.data.some(item => item.price.product === productId)) {
            const subscriptionId = subscription.id;
            const cancelSubscriptionUrl = `https://api.stripe.com/v1/subscriptions/${subscriptionId}`;

            console.log(`Cancelling subscription: ${subscriptionId}`);

            const cancelOptions = {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
              },
            };

            await new Promise((resolve) => {
              const cancelRequest = https.request(cancelSubscriptionUrl, cancelOptions, (cancelResponse) => {
                cancelResponse.on('data', () => {}); // Consume response data
                cancelResponse.on('end', () => {
                  console.log(`Canceled subscription: ${subscriptionId}`);
                  canceledCount++;
                  resolve();
                });
              });

              cancelRequest.end();
            });
          }
        }

        console.log(`Total subscriptions canceled: ${canceledCount}`);
      } else {
        console.error(`Error fetching subscriptions: ${listResponse.statusCode}`);
      }
    });
  });
};

// Call the function with your product ID and Stripe API key
const productId = 'prod_GLvwpkWXelREjH';
const apiKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;
if (!apiKey) {
    console.error('Missing STRIPE_SECRET_KEY in the environment.');
    console.error('Run:  source ~/.poteau/stripe.env');
    process.exit(1);
}


cancelSubscriptionsForProduct(productId, apiKey);


// const stripe = require('stripe')(apiKey);
//
// const cancelSubscriptionsForProduct = async (productId) => {
//   try {
//     let canceledCount = 0;
//
//     const allSubscriptions = await stripe.subscriptions.list();
//     const subscriptionsToCancel = allSubscriptions.data.filter(subscription =>
//       subscription.items.data.some(item => item.price.product === productId)
//     );
//
//     for (const subscription of subscriptionsToCancel) {
//       await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });
//       console.log(`Canceled subscription: ${subscription.id}`);
//       canceledCount++;
//     }
//
//     console.log(`Total subscriptions canceled: ${canceledCount}`);
//   } catch (error) {
//     console.error('Error canceling subscriptions:', error.message);
//   }
// };
//
// // Call the function with your product ID
// const productId = 'prod_GLvwpkWXelREjH';
// cancelSubscriptionsForProduct(productId);
