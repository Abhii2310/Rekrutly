import 'server-only';
import { MAX_RESUME_CHARS } from './rules';

export const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** Text from an uploaded PDF or text file. Throws if the file cannot be read. */
export async function extractResumeText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  let text: string;
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    text = (await extractText(pdf, { mergePages: true })).text;
  } else {
    text = await file.text();
  }
  return text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim().slice(0, MAX_RESUME_CHARS);
}
