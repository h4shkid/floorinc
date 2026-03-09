```bash
# Step 1: Get auth token
TOKEN=$(curl -s -X POST "https://incstores.cloud.akeneo.com/api/oauth/v1/token" \
  -u "${CLIENT_ID}:${CLIENT_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"password","username":"'${USERNAME}'","password":"'${PASSWORD}'"}' \
  | jq -r '.access_token')

# Step 2: PATCH product — sets promise_date + flags it for Magento sync
curl -X PATCH "https://incstores.cloud.akeneo.com/api/rest/v1/products/{sku}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "values": {
      "promise_date": [{"data": "03/15/2026", "locale": null, "scope": null}],
      "connector_magento_sync": [{"data": true, "locale": null, "scope": null}]
    }
  }'
```
