hey liz, thanks so much for the detailed input — super helpful! heres what weve done based on your feedback

1. kit items — fixed
you were right, kit lines carry the revenue while exploded components show $0. we updated the sync to include kit items alongside invtpart. this recovered $493k in revenue across 471 kit skus that we were completely missing (about 10.5% of total revenue)

2. cash sales — investigated
we did a deep dive on this. turns out there are no cash sale transactions in the system — only 5 transaction types exist: salesord, itemship, invadjst, itemrcpt, and custinvc (just 2 invoices). we checked so-88923 and all related transactions for that customer — only sos and item fulfillments. revenue appears to live directly on the sales order lines in this account so were capturing it correctly now

3. item fulfillments — confirmed
all 27k if lines have $0 revenue as expected. our item_revenue > 0 filter already excludes these correctly

4. warehouse question
right now the platform is pulling inventory stock from tn dc only (location id 3) since it handles ~95% of all fulfillments. are there any other locations we should be including for stock levels? for reference heres what we see

| location | skus | stock |
|----------|------|-------|
| drop ship (virtual) | 14,044 | 112,336,741 |
| tn dc | 448 | 745,913 |
| az samples | 4,097 | 629,820 |
| drop ship (stock available) | 2 | 8,216 |

should we keep it tn dc only or include any others for reorder decisions?

thanks again — your input directly led to finding the kit revenue gap and a channel mapping bug
