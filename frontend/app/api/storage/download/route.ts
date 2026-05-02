import { NextRequest, NextResponse } from 'next/server'
import { downloadFromStorage } from '@/lib/0g/storage'

export async function GET(req: NextRequest) {
  const rootHash = req.nextUrl.searchParams.get('rootHash')

  if (!rootHash) {
    return NextResponse.json({ error: 'rootHash query param is required' }, { status: 400 })
  }

  try {
    const data = await downloadFromStorage(rootHash)
    const body = JSON.stringify(data, null, 2)
    const shortHash = rootHash.slice(0, 10)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="artifact-${shortHash}.json"`,
        'Content-Length': String(Buffer.byteLength(body)),
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
