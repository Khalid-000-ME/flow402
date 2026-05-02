import { NextResponse } from 'next/server'
import { uploadToStorage } from '@/lib/0g/storage'

export async function POST(req: Request) {
  const { data, label } = await req.json()

  if (!data) {
    return NextResponse.json({ error: 'data is required' }, { status: 400 })
  }

  try {
    const { rootHash } = await uploadToStorage(data)
    return NextResponse.json({
      rootHash,
      storagescanUrl: `https://storagescan.0g.ai/tx/${rootHash}`,
      label,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
