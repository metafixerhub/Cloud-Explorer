/**
 * Automatically classifies file into one of the 10 categories:
 * Images, PDFs, Excel, Word, PowerPoint, Videos, Audio, ZIP, Text, Others
 * Uses both extension and verified MIME types.
 */
export function detectCategory(filename = '', mimeType = '') {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // 1. Images
  if (
    mimeType.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'psd', 'ai'].includes(ext)
  ) {
    return 'Images';
  }

  // 2. PDFs
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return 'PDFs';
  }

  // 3. Excel
  if (
    ['xls', 'xlsx', 'csv', 'ods', 'tsv'].includes(ext) ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType === 'text/csv'
  ) {
    return 'Excel';
  }

  // 4. Word
  if (
    ['doc', 'docx', 'odt', 'rtf'].includes(ext) ||
    mimeType.includes('word') ||
    mimeType.includes('document')
  ) {
    return 'Word';
  }

  // 5. PowerPoint
  if (
    ['ppt', 'pptx', 'odp'].includes(ext) ||
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint')
  ) {
    return 'PowerPoint';
  }

  // 6. Videos
  if (
    mimeType.startsWith('video/') ||
    ['mp4', 'mov', 'avi', 'wmv', 'mkv', 'flv', 'webm', 'm4v', '3gp'].includes(ext)
  ) {
    return 'Videos';
  }

  // 7. Audio
  if (
    mimeType.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext)
  ) {
    return 'Audio';
  }

  // 8. ZIP & Archives
  if (
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'apk', 'exe'].includes(ext) ||
    mimeType.includes('archive') ||
    mimeType.includes('compressed') ||
    mimeType.includes('zip') ||
    mimeType.includes('x-tar') ||
    mimeType.includes('x-7z-compressed')
  ) {
    return 'ZIP';
  }

  // 9. Text & Code
  if (
    mimeType.startsWith('text/') ||
    ['txt', 'md', 'markdown', 'json', 'html', 'htm', 'xml', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'css', 'sql', 'log', 'env', 'sh', 'bat', 'ps1', 'yml', 'yaml'].includes(ext)
  ) {
    return 'Text';
  }

  // 10. Others
  return 'Others';
}
