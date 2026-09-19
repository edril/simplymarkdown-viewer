import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Markdown from 'react-native-markdown-display';
import { marked } from 'marked';
import { toBlob } from 'html-to-image';

type Mode = 'preview' | 'edit';

const lightTheme = {
  background: '#faf9f7',
  surface: '#ffffff',
  border: '#e6e2db',
  text: '#1f1c17',
  muted: '#8a8478',
  accent: '#b5651d',
  accentText: '#ffffff',
  codeBackground: '#f1efe9',
  danger: '#b3261e',
};

const darkTheme = {
  background: '#181614',
  surface: '#211f1c',
  border: '#332f29',
  text: '#f3efe8',
  muted: '#a39b8c',
  accent: '#e0913f',
  accentText: '#1f1c17',
  codeBackground: '#28251f',
  danger: '#ff6b60',
};

const hasFileSystemAccess =
  Platform.OS === 'web' && typeof window !== 'undefined' && typeof (window as any).showOpenFilePicker === 'function';

const MARKDOWN_PICKER_TYPES = {
  types: [
    {
      description: 'Markdown',
      accept: { 'text/markdown': ['.md', '.markdown'] },
    },
  ],
};

function isAbortError(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as any).name === 'AbortError';
}

async function readFileAsText(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    return await response.text();
  }
  return await new File(asset.uri).text();
}

function writeNativeFile(uri: string, content: string) {
  const file = new File(uri);
  file.create({ overwrite: true, intermediates: true });
  file.write(content);
  return file;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadTextFile(content: string, fileName: string, mime: string) {
  downloadBlob(new Blob([content], { type: mime }), fileName);
}

function baseNameFor(fileName: string | null): string {
  return (fileName || 'Untitled').replace(/\.(md|markdown)$/i, '');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// Styling for exported HTML/PNG documents: always light, so the output looks
// right regardless of the app's current theme or where it ends up (chat,
// forum, docs site, printed).
const EXPORT_CSS = `
  .md-export { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; background: #faf9f7; color: #1f1c17; font-size: 17px; line-height: 1.6; padding: 32px; box-sizing: border-box; }
  .md-export h1, .md-export h2, .md-export h3, .md-export h4, .md-export h5, .md-export h6 { font-weight: 700; line-height: 1.3; }
  .md-export h1 { font-size: 30px; margin: 8px 0 16px; padding-bottom: 10px; border-bottom: 1px solid #e6e2db; }
  .md-export h2 { font-size: 24px; margin: 28px 0 12px; }
  .md-export h3 { font-size: 20px; margin: 22px 0 10px; }
  .md-export h4, .md-export h5, .md-export h6 { font-size: 16px; margin: 18px 0 8px; }
  .md-export a { color: #b5651d; text-decoration: underline; }
  .md-export code { background: #f1efe9; border-radius: 4px; padding: 2px 5px; font-family: Menlo, Consolas, monospace; font-size: 0.9em; }
  .md-export pre { background: #f1efe9; border-radius: 8px; padding: 14px; overflow: auto; }
  .md-export pre code { background: none; padding: 0; }
  .md-export blockquote { background: #ffffff; border-left: 4px solid #b5651d; margin: 12px 0; padding: 8px 14px; border-radius: 4px; }
  .md-export table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  .md-export th, .md-export td { border: 1px solid #e6e2db; padding: 8px; text-align: left; }
  .md-export th { background: #ffffff; font-weight: 700; }
  .md-export img { max-width: 100%; }
  .md-export hr { border: none; border-top: 1px solid #e6e2db; margin: 24px 0; }
`;

function buildExportHtml(markdownText: string, title: string): string {
  const inner = marked.parse(markdownText, { gfm: true, breaks: false }) as string;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${EXPORT_CSS}</style>
</head>
<body>
<div class="md-export">${inner}</div>
</body>
</html>
`;
}

async function renderMarkdownToPngBlob(markdownText: string): Promise<Blob> {
  const inner = marked.parse(markdownText, { gfm: true, breaks: false }) as string;
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '1000px';
  container.innerHTML = `<style>${EXPORT_CSS}</style><div class="md-export">${inner}</div>`;
  document.body.appendChild(container);
  try {
    if ((document as any).fonts?.ready) await (document as any).fonts.ready;
    const node = container.querySelector('.md-export') as HTMLElement;
    const blob = await toBlob(node, { width: 1000, backgroundColor: '#faf9f7', pixelRatio: 2 });
    if (!blob) throw new Error('Failed to render image');
    return blob;
  } finally {
    document.body.removeChild(container);
  }
}

export default function App() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;

  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [savedContent, setSavedContent] = useState<string>('');
  const [fileHandle, setFileHandle] = useState<any>(null); // web/electron: FileSystemFileHandle
  const [nativeUri, setNativeUri] = useState<string | null>(null); // iOS/Android
  const [mode, setMode] = useState<Mode>('preview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const confirmResolveRef = useRef<((discard: boolean) => void) | null>(null);
  const [exportMenuVisible, setExportMenuVisible] = useState(false);
  const [exporting, setExporting] = useState(false);

  const hasDocument = fileName !== null;
  const dirty = content !== savedContent;

  function confirmDiscardIfDirty(): Promise<boolean> {
    if (!dirty) return Promise.resolve(true);
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmVisible(true);
    });
  }

  function resolveDiscardPrompt(discard: boolean) {
    setConfirmVisible(false);
    confirmResolveRef.current?.(discard);
    confirmResolveRef.current = null;
  }

  async function newDocument() {
    if (!(await confirmDiscardIfDirty())) return;
    setError(null);
    setContent('');
    setSavedContent('');
    setFileName('Untitled.md');
    setFileHandle(null);
    setNativeUri(null);
    setMode('edit');
  }

  async function openFile() {
    if (!(await confirmDiscardIfDirty())) return;
    setError(null);
    try {
      if (hasFileSystemAccess) {
        const [handle] = await (window as any).showOpenFilePicker(MARKDOWN_PICKER_TYPES);
        setLoading(true);
        const file = await handle.getFile();
        const text = await file.text();
        setContent(text);
        setSavedContent(text);
        setFileName(file.name);
        setFileHandle(handle);
        setNativeUri(null);
        setMode('preview');
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/markdown', 'text/plain', 'text/x-markdown', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setLoading(true);
      const text = await readFileAsText(asset);
      setContent(text);
      setSavedContent(text);
      setFileName(asset.name);
      setFileHandle(null);
      setNativeUri(Platform.OS === 'web' ? null : asset.uri);
      setMode('preview');
    } catch (e) {
      if (!isAbortError(e)) setError('Could not open that file.');
    } finally {
      setLoading(false);
    }
  }

  async function saveFile() {
    setError(null);
    setSaving(true);
    try {
      if (hasFileSystemAccess) {
        if (fileHandle) {
          const writable = await fileHandle.createWritable();
          await writable.write(content);
          await writable.close();
        } else {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName || 'Untitled.md',
            ...MARKDOWN_PICKER_TYPES,
          });
          const writable = await handle.createWritable();
          await writable.write(content);
          await writable.close();
          setFileHandle(handle);
          setFileName(handle.name);
        }
        setSavedContent(content);
      } else if (Platform.OS === 'web') {
        downloadTextFile(content, fileName || 'Untitled.md', 'text/markdown');
        setSavedContent(content);
      } else if (nativeUri) {
        writeNativeFile(nativeUri, content);
        setSavedContent(content);
      } else {
        const file = new File(Paths.document, fileName || 'Untitled.md');
        file.create({ overwrite: true });
        file.write(content);
        setNativeUri(file.uri);
        setSavedContent(content);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri);
        }
      }
    } catch (e) {
      if (!isAbortError(e)) setError('Could not save the file.');
    } finally {
      setSaving(false);
    }
  }

  async function exportHtml() {
    setExportMenuVisible(false);
    setError(null);
    setExporting(true);
    try {
      const name = baseNameFor(fileName);
      const html = buildExportHtml(content, name);
      const suggested = `${name}.html`;
      if (hasFileSystemAccess) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: suggested,
          types: [{ description: 'HTML', accept: { 'text/html': ['.html'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(html);
        await writable.close();
      } else if (Platform.OS === 'web') {
        downloadTextFile(html, suggested, 'text/html');
      } else {
        const file = new File(Paths.document, suggested);
        file.create({ overwrite: true });
        file.write(html);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri);
        }
      }
    } catch (e) {
      if (!isAbortError(e)) setError('Could not export HTML.');
    } finally {
      setExporting(false);
    }
  }

  async function exportPng() {
    setExportMenuVisible(false);
    setError(null);
    setExporting(true);
    try {
      const blob = await renderMarkdownToPngBlob(content);
      const suggested = `${baseNameFor(fileName)}.png`;
      if (hasFileSystemAccess) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: suggested,
          types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        downloadBlob(blob, suggested);
      }
    } catch (e) {
      if (!isAbortError(e)) setError('Could not export image.');
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (hasDocument) saveFile();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const markdownStyles = buildMarkdownStyles(theme);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {fileName ?? 'SimplyMarkdown Viewer'}
              </Text>
              {dirty && <View style={[styles.dirtyDot, { backgroundColor: theme.accent }]} />}
            </View>
            {!hasDocument && (
              <Text style={[styles.subtitle, { color: theme.muted }]}>Open or create a .md file to get started</Text>
            )}
          </View>

          <View style={styles.headerRight}>
            {hasDocument && (
              <View style={[styles.segmented, { borderColor: theme.border }]}>
                <SegmentButton
                  label="Preview"
                  active={mode === 'preview'}
                  onPress={() => setMode('preview')}
                  theme={theme}
                />
                <SegmentButton
                  label="Edit"
                  active={mode === 'edit'}
                  onPress={() => setMode('edit')}
                  theme={theme}
                />
              </View>
            )}
            <Pressable
              onPress={newDocument}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>New</Text>
            </Pressable>
            <Pressable
              onPress={openFile}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Open…</Text>
            </Pressable>
            {hasDocument && (
              <Pressable
                onPress={() => setExportMenuVisible(true)}
                disabled={exporting}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.border, opacity: pressed || exporting ? 0.7 : 1 },
                ]}
              >
                {exporting ? (
                  <ActivityIndicator color={theme.text} size="small" />
                ) : (
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Export…</Text>
                )}
              </Pressable>
            )}
            {hasDocument && (
              <Pressable
                onPress={saveFile}
                disabled={saving}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.accent, opacity: pressed || saving ? 0.85 : 1 },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={theme.accentText} size="small" />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: theme.accentText }]}>Save</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        ) : !hasDocument ? (
          <View style={styles.centerFill}>
            <Text style={[styles.emptyIcon]}>📄</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No document open</Text>
            <Text style={[styles.emptyBody, { color: theme.muted }]}>
              Open an existing Markdown file, or start a new one.
            </Text>
            <View style={styles.emptyActions}>
              <Pressable
                onPress={openFile}
                style={({ pressed }) => [
                  styles.emptyButton,
                  { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.primaryButtonText, { color: theme.accentText }]}>Open Markdown File</Text>
              </Pressable>
              <Pressable onPress={newDocument} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[styles.newDocLink, { color: theme.accent }]}>New Document</Text>
              </Pressable>
            </View>
          </View>
        ) : mode === 'preview' ? (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.previewContent}
            showsVerticalScrollIndicator={false}
          >
            {content.length === 0 ? (
              <Text style={{ color: theme.muted, fontSize: 15 }}>Nothing to preview yet — switch to Edit to start writing.</Text>
            ) : (
              <Markdown style={markdownStyles}>{content}</Markdown>
            )}
          </ScrollView>
        ) : (
          <TextInput
            style={[
              styles.editor,
              { color: theme.text, backgroundColor: theme.background },
            ]}
            multiline
            value={content}
            onChangeText={setContent}
            autoCorrect={false}
            autoCapitalize="none"
            textAlignVertical="top"
            placeholder="Start writing…"
            placeholderTextColor={theme.muted}
          />
        )}

        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => resolveDiscardPrompt(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Discard unsaved changes?</Text>
              <Text style={[styles.modalBody, { color: theme.muted }]}>
                {fileName ?? 'This document'} has unsaved changes that will be lost.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => resolveDiscardPrompt(false)}
                  style={({ pressed }) => [styles.modalButton, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => resolveDiscardPrompt(true)}
                  style={({ pressed }) => [styles.modalButton, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.modalButtonText, { color: theme.danger, fontWeight: '700' }]}>Discard</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={exportMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setExportMenuVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setExportMenuVisible(false)}>
            <Pressable
              onPress={(e) => e.stopPropagation?.()}
              style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[styles.modalTitle, { color: theme.text }]}>Export</Text>
              <Text style={[styles.modalBody, { color: theme.muted }]}>
                Exports always use a clean light document style, regardless of the app's current theme.
              </Text>
              <Pressable
                onPress={exportHtml}
                style={({ pressed }) => [styles.exportOption, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.exportOptionText, { color: theme.text }]}>Export as HTML</Text>
              </Pressable>
              {Platform.OS === 'web' && (
                <Pressable
                  onPress={exportPng}
                  style={({ pressed }) => [styles.exportOption, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.exportOptionText, { color: theme.text }]}>Export as Image (PNG)</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setExportMenuVisible(false)}
                style={({ pressed }) => [styles.modalButton, { alignSelf: 'flex-end', marginTop: 8, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.modalButtonText, { color: theme.muted }]}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: typeof lightTheme;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segmentButton,
        active && { backgroundColor: theme.accent },
      ]}
    >
      <Text
        style={[
          styles.segmentButtonText,
          { color: active ? theme.accentText : theme.muted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function buildMarkdownStyles(theme: typeof lightTheme) {
  return StyleSheet.create({
    body: { color: theme.text, fontSize: 17, lineHeight: 26 },
    heading1: {
      color: theme.text,
      fontSize: 30,
      fontWeight: '700',
      marginTop: 8,
      marginBottom: 12,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    heading2: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '700',
      marginTop: 20,
      marginBottom: 10,
    },
    heading3: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '600',
      marginTop: 16,
      marginBottom: 8,
    },
    heading4: { color: theme.text, fontSize: 18, fontWeight: '600', marginTop: 12, marginBottom: 6 },
    heading5: { color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 10, marginBottom: 6 },
    heading6: { color: theme.muted, fontSize: 15, fontWeight: '600', marginTop: 10, marginBottom: 6 },
    link: { color: theme.accent, textDecorationLine: 'underline' },
    blockquote: {
      backgroundColor: theme.surface,
      borderLeftWidth: 4,
      borderLeftColor: theme.accent,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginVertical: 10,
      borderRadius: 4,
    },
    code_inline: {
      backgroundColor: theme.codeBackground,
      color: theme.text,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    },
    code_block: {
      backgroundColor: theme.codeBackground,
      color: theme.text,
      borderRadius: 8,
      padding: 14,
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
      fontSize: 14,
    },
    fence: {
      backgroundColor: theme.codeBackground,
      color: theme.text,
      borderRadius: 8,
      padding: 14,
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
      fontSize: 14,
    },
    hr: { backgroundColor: theme.border, height: StyleSheet.hairlineWidth, marginVertical: 20 },
    bullet_list: { marginVertical: 6 },
    ordered_list: { marginVertical: 6 },
    list_item: { marginVertical: 3 },
    table: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 6,
      marginVertical: 12,
    },
    th: { padding: 8, backgroundColor: theme.surface, fontWeight: '700', color: theme.text },
    tr: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
    td: { padding: 8, color: theme.text },
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
  });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
    flexWrap: 'wrap',
  },
  headerLeft: { flex: 1, minWidth: 120 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 17, fontWeight: '600' },
  subtitle: { fontSize: 13, marginTop: 2 },
  dirtyDot: { width: 7, height: 7, borderRadius: 4 },
  segmented: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  segmentButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  segmentButtonText: { fontSize: 13, fontWeight: '600' },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '600' },
  primaryButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, minWidth: 64, alignItems: 'center' },
  primaryButtonText: { fontSize: 14, fontWeight: '600' },
  body: { flex: 1 },
  previewContent: { paddingHorizontal: 24, paddingVertical: 24, maxWidth: 760, width: '100%', alignSelf: 'center' },
  editor: {
    flex: 1,
    padding: 20,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', maxWidth: 320, marginBottom: 16 },
  emptyActions: { alignItems: 'center', gap: 14 },
  emptyButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  newDocLink: { fontSize: 14, fontWeight: '600' },
  errorBanner: { backgroundColor: '#fdecea', padding: 10, alignItems: 'center' },
  errorText: { color: '#b3261e', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  modalBody: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  modalButton: { paddingVertical: 6, paddingHorizontal: 4 },
  modalButtonText: { fontSize: 14, fontWeight: '600' },
  exportOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
  },
  exportOptionText: { fontSize: 14, fontWeight: '600' },
});
