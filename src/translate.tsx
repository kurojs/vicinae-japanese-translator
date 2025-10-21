import React, { useState, useEffect } from "react";
import {
  Action,
  ActionPanel,
  Clipboard,
  List,
  getPreferenceValues,
  getSelectedText,
  showToast,
  Toast,
  Icon,
  Color,
  environment,
} from "@vicinae/api";
import { fetch } from "undici";
import { writeFile, unlink } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";

const execAsync = promisify(exec);

interface Preferences {
  ankiDeck: string;
  ankiModel: string;
  ankiPort: string;
  voicevoxPort: string;
  voicevoxSpeaker: string;
  sourceLang: string;
  targetLang: string;
  autoLoadText: boolean;
}

interface TranslationState {
  text: string;
  translation: string;
  isLoading: boolean;
  error?: string;
}

// Function to translate using Google Translate
async function translateText(
  text: string,
  from: string,
  to: string,
): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;

  try {
    const response = await fetch(url);
    const data = (await response.json()) as any;
    const translatedText = data[0]?.map((item: any) => item[0]).join("") || "";
    return translatedText;
  } catch (error) {
    throw new Error(`Translation failed: ${error}`);
  }
}

// Function to verify AnkiConnect
async function checkAnkiConnect(port: string = "8765"): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "version", version: 6 }),
    });
    const result = (await response.json()) as any;
    return result.result !== null && result.result >= 6;
  } catch {
    return false;
  }
}

// Function to check if the model exists
async function checkModelExists(
  modelName: string,
  port: string = "8765",
): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "modelNames", version: 6 }),
    });
    const result = (await response.json()) as any;
    const models = result.result || [];
    return models.includes(modelName);
  } catch {
    return false;
  }
}

// Function to get the fields of a model
async function getModelFields(
  modelName: string,
  port: string = "8765",
): Promise<string[]> {
  try {
    const response = await fetch(`http://localhost:${port}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "modelFieldNames",
        version: 6,
        params: { modelName },
      }),
    });
    const result = (await response.json()) as any;
    return result.result || [];
  } catch {
    return [];
  }
}

// Function to create deck if it doesn't exist
async function ensureDeckExists(
  deckName: string,
  port: string = "8765",
): Promise<void> {
  const url = `http://localhost:${port}`;

  try {
    const checkResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deckNames", version: 6 }),
    });

    const checkResult = (await checkResponse.json()) as any;
    const decks = checkResult.result || [];

    if (!decks.includes(deckName)) {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createDeck",
          version: 6,
          params: { deck: deckName },
        }),
      });
    }
  } catch (error) {
    console.error("Error ensuring deck exists:", error);
  }
}

// Function to add to Anki
async function addToAnki(
  deckName: string,
  modelName: string,
  front: string,
  back: string,
  port: string = "8765",
): Promise<void> {
  const url = `http://localhost:${port}`;

  // Verify that the deck exists
  await ensureDeckExists(deckName, port);

  // Verify that the model exists
  const modelExists = await checkModelExists(modelName, port);
  if (!modelExists) {
    throw new Error(
      `Model "${modelName}" does not exist in Anki. Please check your preferences.`,
    );
  }

  // Get the model fields
  const fields = await getModelFields(modelName, port);
  console.log("Model fields:", fields);

  if (fields.length < 2) {
    throw new Error(`Model "${modelName}" needs at least 2 fields`);
  }

  // Build the fields dynamically
  const noteFields: any = {};

  // Try using common names first
  if (fields.includes("Front")) {
    noteFields["Front"] = front;
  } else if (fields.includes("Expression")) {
    noteFields["Expression"] = front;
  } else if (fields.includes("Word")) {
    noteFields["Word"] = front;
  } else {
    // Use the first field
    noteFields[fields[0]] = front;
  }

  if (fields.includes("Back")) {
    noteFields["Back"] = back;
  } else if (fields.includes("Meaning")) {
    noteFields["Meaning"] = back;
  } else if (fields.includes("Translation")) {
    noteFields["Translation"] = back;
  } else {
    // Use the second field
    noteFields[fields[1]] = back;
  }

  const requestData = {
    action: "addNote",
    version: 6,
    params: {
      note: {
        deckName: deckName,
        modelName: modelName,
        fields: noteFields,
        options: {
          allowDuplicate: false,
        },
        tags: ["vicinae", "japanese", "n1"],
      },
    },
  };

  console.log("Sending to Anki:", JSON.stringify(requestData, null, 2));

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData),
  });

  const result = (await response.json()) as any;

  console.log("Anki response:", JSON.stringify(result, null, 2));

  if (result.error) {
    throw new Error(result.error);
  }

  if (!result.result) {
    throw new Error(
      "Failed to add note - Anki returned null. Check the Anki error log.",
    );
  }
}

// Function to play audio with VoiceVox
async function playVoiceVoxAudio(
  text: string,
  speaker: string = "1",
  port: string = "50021",
): Promise<void> {
  // Step 1: Create audio query
  const queryResponse = await fetch(
    `http://localhost:${port}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`,
    { method: "POST" },
  );

  if (!queryResponse.ok) {
    throw new Error(`Failed to create audio query: ${queryResponse.status}`);
  }

  const audioQuery = await queryResponse.json();

  // Step 2: Synthesize audio
  const synthesisResponse = await fetch(
    `http://localhost:${port}/synthesis?speaker=${speaker}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(audioQuery),
    },
  );

  if (!synthesisResponse.ok) {
    throw new Error(`Failed to synthesize audio: ${synthesisResponse.status}`);
  }

  // Step 3: Save the audio to temp and play it
  const audioBuffer = await synthesisResponse.arrayBuffer();
  const audioData = Buffer.from(audioBuffer);

  if (audioData.length === 0) {
    throw new Error("Empty audio generated");
  }

  // Save to temporary directory
  const tempDir = environment.supportPath;
  const audioPath = join(tempDir, `voicevox_${Date.now()}.wav`);

  await writeFile(audioPath, audioData);

  // Play with the available player on the system
  let playCommand = "";

  // Try different players in order of preference
  try {
    await execAsync("which ffplay");
    playCommand = `ffplay -nodisp -autoexit "${audioPath}" 2>/dev/null`;
  } catch {
    try {
      await execAsync("which mpv");
      playCommand = `mpv --no-video --really-quiet "${audioPath}"`;
    } catch {
      try {
        await execAsync("which afplay"); // macOS
        playCommand = `afplay "${audioPath}"`;
      } catch {
        // Clean up temporary file
        await unlink(audioPath).catch(() => {});
        throw new Error(
          "No audio player found. Please install ffplay, mpv, or afplay",
        );
      }
    }
  }

  // Play the audio
  exec(playCommand, async (error) => {
    // Clean up temporary file after playing
    await unlink(audioPath).catch(() => {});

    if (error) {
      console.error("Error playing audio:", error);
    }
  });
}

function TranslationListItem({
  text,
  translation,
  isLoading,
  isShowingDetail,
  onAddToAnki,
  onPlayAudio,
  preferences,
}: {
  text: string;
  translation: string;
  isLoading: boolean;
  isShowingDetail: boolean;
  onAddToAnki: () => Promise<void>;
  onPlayAudio: () => Promise<void>;
  preferences: Preferences;
}) {
  const markdown = `${translation}`;

  return (
    <List.Item
      title={text}
      subtitle={translation}
      detail={<List.Item.Detail markdown={markdown} />}
      actions={
        <ActionPanel>
          <Action
            title="Add to Anki"
            icon={{ source: Icon.Plus, tintColor: Color.Green }}
            onAction={onAddToAnki}
            shortcut={{ modifiers: ["cmd"], key: "a" }}
          />
          <Action
            title="Play Audio"
            icon={{ source: Icon.SpeakerOn, tintColor: Color.Blue }}
            onAction={onPlayAudio}
            shortcut={{ modifiers: ["cmd"], key: "p" }}
          />
          <Action
            title="Copy Translation"
            icon={Icon.Clipboard}
            onAction={async () => {
              await Clipboard.copy(translation);
              await showToast({
                style: Toast.Style.Success,
                title: "Copied!",
              });
            }}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action
            title="Copy Original"
            icon={Icon.Clipboard}
            onAction={async () => {
              await Clipboard.copy(text);
              await showToast({
                style: Toast.Style.Success,
                title: "Copied!",
              });
            }}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const [searchText, setSearchText] = useState("");
  const [translationState, setTranslationState] = useState<TranslationState>({
    text: "",
    translation: "",
    isLoading: false,
  });
  const [isShowingDetail, setIsShowingDetail] = useState(true);
  const [debouncedText, setDebouncedText] = useState("");

  // Auto-load text from clipboard on startup
  useEffect(() => {
    const loadInitialText = async () => {
      try {
        const selectedText = await getSelectedText();
        if (selectedText) {
          setSearchText(selectedText);
          return;
        }
      } catch {}

      try {
        const clipboardText = await Clipboard.readText();
        if (clipboardText && preferences.autoLoadText) {
          setSearchText(clipboardText);
        }
      } catch {}
    };

    loadInitialText();
  }, []);

  // Debounce for automatic translation
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedText(searchText.trim());
    }, 500);

    return () => clearTimeout(timer);
  }, [searchText]);

  // Translate when debounced text changes
  useEffect(() => {
    if (!debouncedText) {
      setTranslationState({ text: "", translation: "", isLoading: false });
      return;
    }

    const doTranslate = async () => {
      setTranslationState((prev) => ({ ...prev, isLoading: true }));

      try {
        const translation = await translateText(
          debouncedText,
          preferences.sourceLang,
          preferences.targetLang,
        );

        setTranslationState({
          text: debouncedText,
          translation,
          isLoading: false,
        });
      } catch (error) {
        setTranslationState({
          text: debouncedText,
          translation: "",
          isLoading: false,
          error: String(error),
        });

        await showToast({
          style: Toast.Style.Failure,
          title: "Translation failed",
          message: String(error),
        });
      }
    };

    doTranslate();
  }, [debouncedText]);

  const handleAddToAnki = async () => {
    if (!translationState.text || !translationState.translation) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Nothing to add",
      });
      return;
    }

    const isConnected = await checkAnkiConnect(preferences.ankiPort);
    if (!isConnected) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Anki not connected",
        message: `Make sure Anki is running with AnkiConnect on port ${preferences.ankiPort}`,
      });
      return;
    }

    try {
      await addToAnki(
        preferences.ankiDeck,
        preferences.ankiModel,
        translationState.text,
        translationState.translation,
        preferences.ankiPort,
      );

      await showToast({
        style: Toast.Style.Success,
        title: "Added to Anki! ✅",
        message: `Card added to ${preferences.ankiDeck}`,
      });
    } catch (error) {
      console.error("Anki error details:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to add to Anki",
        message: String(error),
      });
    }
  };

  const handlePlayAudio = async () => {
    if (!translationState.text) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No text to play",
      });
      return;
    }

    try {
      await playVoiceVoxAudio(
        translationState.text,
        preferences.voicevoxSpeaker,
        preferences.voicevoxPort,
      );

      await showToast({
        style: Toast.Style.Success,
        title: "Playing audio! 🔊",
      });
    } catch (error) {
      console.error("Audio error details:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to play audio",
        message: String(error),
      });
    }
  };

  return (
    <List
      searchBarPlaceholder="Enter Japanese text to translate..."
      searchText={searchText}
      onSearchTextChange={setSearchText}
      isLoading={translationState.isLoading}
      isShowingDetail={isShowingDetail}
    >
      {translationState.translation ? (
        <TranslationListItem
          text={translationState.text}
          translation={translationState.translation}
          isLoading={translationState.isLoading}
          isShowingDetail={isShowingDetail}
          onAddToAnki={handleAddToAnki}
          onPlayAudio={handlePlayAudio}
          preferences={preferences}
        />
      ) : (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="Enter Japanese text to translate"
          description="Type or paste text in the search bar above"
        />
      )}
    </List>
  );
}
