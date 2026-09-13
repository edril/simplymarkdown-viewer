import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import * as FileSystem from 'expo-file-system';
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
};

async function readFileAsText(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    return await response.text();
  }
  return await FileSystem.readAsStringAsync(asset.uri);
}

export default function App() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;

  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [mode, setMode] = useState<Mode>('preview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFile = useCallback(async () => {
    setError(null);
    try {
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
      setFileName(asset.name);
      setMode('preview');
    } catch (e) {
      setError('Could not open that file.');
    } finally {
      setLoading(false);
    }
  }, []);

  const markdownStyles = useMemo(() => buildMarkdownStyles(theme), [theme]);

  const hasDocument = fileName !== null;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {fileName ?? 'SimplyMarkdown Viewer'}
            </Text>
            {!hasDocument && (
              <Text style={[styles.subtitle, { color: theme.muted }]}>Open a .md file to get started</Text>
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
                  label="Raw"
                  active={mode === 'edit'}
                  onPress={() => setMode('edit')}
                  theme={theme}
                />
              </View>
            )}
            <Pressable
              onPress={openFile}
              style={({ pressed }) => [
                styles.openButton,
                { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.openButtonText, { color: theme.accentText }]}>Open…</Text>
            </Pressable>
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
              Choose a Markdown file to view it in a clean, readable preview.
            </Text>
            <Pressable
              onPress={openFile}
              style={({ pressed }) => [
                styles.emptyButton,
                { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.openButtonText, { color: theme.accentText }]}>Open Markdown File</Text>
            </Pressable>
          </View>
        ) : mode === 'preview' ? (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.previewContent}
            showsVerticalScrollIndicator={false}
          >
            <Markdown style={markdownStyles}>{content}</Markdown>
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
          />
        )}
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
  },
  headerLeft: { flex: 1, minWidth: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 17, fontWeight: '600' },
  subtitle: { fontSize: 13, marginTop: 2 },
  segmented: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  segmentButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  segmentButtonText: { fontSize: 13, fontWeight: '600' },
  openButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  openButtonText: { fontSize: 14, fontWeight: '600' },
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
  emptyButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  errorBanner: { backgroundColor: '#fdecea', padding: 10, alignItems: 'center' },
  errorText: { color: '#b3261e', fontSize: 13 },
});
