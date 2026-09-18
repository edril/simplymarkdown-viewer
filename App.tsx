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

function downloadAsFile(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
        downloadAsFile(content, fileName || 'Untitled.md');
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
});
