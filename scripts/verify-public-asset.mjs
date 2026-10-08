export async function verifyPublicAsset(response, expectedBytes, mimeType, cacheControl) {
  const bytes = Buffer.from(await response.arrayBuffer());
  return response.ok && bytes.equals(expectedBytes) &&
    response.headers.get('content-type')?.split(';')[0].trim() === mimeType &&
    response.headers.get('cache-control') === cacheControl &&
    response.headers.get('access-control-allow-origin') === '*';
}
