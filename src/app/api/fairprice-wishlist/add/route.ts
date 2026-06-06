import { NextResponse } from 'next/server'

interface AddToWishlistRequest {
  productId: string
}

export async function POST(req: Request) {
  const bearerToken = process.env.FAIRPRICE_BEARER_TOKEN
  const akamiCookie = process.env.FAIRPRICE_AKAMAI_COOKIE
  const wishListId = process.env.FAIRPRICE_WISHLIST_ID

  if (!bearerToken || bearerToken === 'your_bearer_token_here') {
    return NextResponse.json(
      { error: 'FAIRPRICE_BEARER_TOKEN not configured in .env.local' },
      { status: 503 }
    )
  }
  if (!wishListId) {
    return NextResponse.json(
      { error: 'FAIRPRICE_WISHLIST_ID not configured in .env.local' },
      { status: 503 }
    )
  }

  let body: AddToWishlistRequest
  try {
    body = (await req.json()) as AddToWishlistRequest
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { productId } = body
  if (!productId || !/^\d+$/.test(productId)) {
    return NextResponse.json({ error: 'Invalid productId' }, { status: 400 })
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${bearerToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': 'https://www.fairprice.com.sg',
    'Referer': 'https://www.fairprice.com.sg/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  }
  if (akamiCookie && akamiCookie !== 'your_ak_bmsc_cookie_value_here') {
    headers['Cookie'] = `ak_bmsc=${akamiCookie}`
  }

  const fpUrl = `https://website-api.omni.fairprice.com.sg/api/product/${productId}/wish-list`

  try {
    const fpRes = await fetch(fpUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ wishListId }),
    })

    const text = await fpRes.text()
    if (!fpRes.ok) {
      return NextResponse.json(
        { error: `FairPrice API returned ${fpRes.status}`, detail: text },
        { status: fpRes.status }
      )
    }

    return NextResponse.json({ success: true, message: text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
