# API Checks — DummyJSON Products

Manual verification of the endpoints ShopLite depends on. All
requests performed in Firefox 157 with the built-in fetch console,
and cross-checked with curl in Terminal.

Base URL: `https://dummyjson.com`

## 1. GET /products/search?q={term}

### Happy path

- **Request:** `GET /products/search?q=phone&limit=3`
- **Status:** 200 OK
- **Response shape:**

  ```json
  {
    "products": [
      {
        "id": 1,
        "title": "iPhone 9",
        "description": "...",
        "price": 549,
        "discountPercentage": 12.96,
        "rating": 4.69,
        "stock": 94,
        "brand": "Apple",
        "category": "smartphones",
        "thumbnail": "https://...",
        "images": ["https://...", "..."]
      }
    ],
    "total": 13,
    "skip": 0,
    "limit": 3
  }