import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	ItemView,
	WorkspaceLeaf,
} from "obsidian";

// ======= Grammar Checker Panel =======
const VIEW_TYPE_GRAMMAR = "grammar-check-view";

class GrammarCheckView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_GRAMMAR;
	}

	getDisplayText(): string {
		return "Grammar Checker";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl("h3", { text: "Grammar Issues" });
		container.createEl("div", { attr: { id: "grammar-issues" } });
	}

	async onClose() {}
}

// ======= Spelling Dictionary =======
const dictionary: Record<string, string> = {
	teh: "the",
	recieve: "receive",
	definately: "definitely",
	adn: "and",
	thier: "their",
	seperate: "separate",
	accomodate: "accommodate",
	acheive: "achieve",
	beleive: "believe",
	embarass: "embarrass",
	neccessary: "necessary",
	grammer: "grammar",
	// ... (you can expand with more entries)
};

// ======= Spell Autocorrect (for single words or full text) =======
function autocorrectText(text: string): string {
	// Fix spelling
	let corrected = text.replace(/\b\w+\b/g, (word) => {
		const lower = word.toLowerCase();
		if (dictionary[lower]) {
			return word[0] === word[0].toUpperCase()
				? dictionary[lower][0].toUpperCase() + dictionary[lower].slice(1)
				: dictionary[lower];
		}
		return word;
	});

	// Capitalize after punctuation + first letter
	corrected = corrected.replace(
		/([.!?]\s+|\n)([a-z])/g,
		(_, sep, char) => sep + char.toUpperCase()
	);
	corrected = corrected.replace(/^([a-z])/, (char) => char.toUpperCase());

	return corrected;
}

// ======= Main Plugin =======
export default class AutoCorrectPlugin extends Plugin {
	async onload() {
		// Register Grammar Panel
		this.registerView(VIEW_TYPE_GRAMMAR, (leaf) => new GrammarCheckView(leaf));

		// Ribbon icon to open grammar panel
		this.addRibbonIcon("check-circle", "Open Grammar Checker", () => {
			this.activateGrammarView();
		});

		// Command: Run autocorrect on full file
		this.addCommand({
			id: "autocorrect-current-file",
			name: "Autocorrect spelling and capitalization",
			editorCallback: (editor: Editor) => {
				const content = editor.getValue();
				const corrected = autocorrectText(content);
				editor.setValue(corrected);
				new Notice("Autocorrection complete!");
			},
		});

		// Command: Run grammar check on full file
		this.addCommand({
			id: "check-grammar-current-file",
			name: "Check Grammar in Current File",
			editorCallback: async (editor: Editor) => {
				const content = editor.getValue();
				await this.checkGrammar(content);
			},
		});

		// Enable live autocorrect (spelling as you type)
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view) this.applyLiveAutocorrect(view.editor);
			})
		);
	}

	// === Open grammar panel ===
	async activateGrammarView() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_GRAMMAR);

		await this.app.workspace.getRightLeaf(false).setViewState({
			type: VIEW_TYPE_GRAMMAR,
			active: true,
		});

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE_GRAMMAR)[0]
		);
	}

	// === Grammar check using LanguageTool API ===
	async checkGrammar(text: string) {
		try {
			const response = await fetch("https://api.languagetoolplus.com/v2/check", {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					text: text,
					language: "en-US",
				}),
			});

			const result = await response.json();
			this.displayGrammarIssues(result);
		} catch (e) {
			new Notice("Error checking grammar.");
			console.error(e);
		}
	}

	// === Show grammar issues in side panel ===
	displayGrammarIssues(result: any) {
		const container = document.getElementById("grammar-issues");
		if (!container) return;

		container.empty();

		if (!result.matches || result.matches.length === 0) {
			container.createEl("p", { text: "No grammar issues found 🎉" });
			return;
		}

		result.matches.forEach((match: any) => {
			const issue = container.createEl("div", { cls: "grammar-issue" });
			issue.createEl("p", { text: `❌ ${match.message}` });

			if (match.replacements && match.replacements.length > 0) {
				const suggestion = match.replacements[0].value;
				const fixBtn = issue.createEl("button", {
					text: `Fix → ${suggestion}`,
				});

				fixBtn.onclick = () => {
					const editor =
						this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
					if (editor) {
						editor.replaceRange(
							suggestion,
							editor.offsetToPos(match.offset),
							editor.offsetToPos(match.offset + match.length)
						);
					}
				};
			}
		});
	}

	// === Live spelling autocorrect (on word completion) ===
	applyLiveAutocorrect(editor: Editor) {
		// Register an event that fires whenever the editor content changes
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor: Editor) => {
        if (!editor) return;

        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);

        if (!line || line.length === 0) return;

        const lastChar = line.charAt(cursor.ch - 1);

        // Run autocorrect when space or punctuation is typed
        if (lastChar === " " || [".", "!", "?"].includes(lastChar)) {
          const corrected = this.autoCorrectLine(line);
          if (corrected !== line) {
            editor.setLine(cursor.line, corrected);
          }
        }

        // Capitalize next word after punctuation
        if ([".", "!", "?"].includes(lastChar)) {
          const nextCharIndex = cursor.ch;
          const nextChar = line[nextCharIndex];
          if (nextChar && /[a-z]/.test(nextChar)) {
            editor.replaceRange(
              nextChar.toUpperCase(),
              { line: cursor.line, ch: nextCharIndex },
              { line: cursor.line, ch: nextCharIndex + 1 }
            );
          }
        }
      })
    );
  }

  onunload() {
    console.log("Unloading AutoCorrect Plugin");
  }
    private autoCorrectLine(line: string): string {
    // Simple spelling autocorrect dictionary
    const corrections: Record<string, string> = {
      teh: "the",
      recieve: "receive",
      adress: "address",
      occurence: "occurrence",
      seperate: "separate",
    };

    // Split line into words and autocorrect
    const words = line.split(/\b/);
    const correctedWords = words.map((word) => {
      const lower = word.toLowerCase();
      if (corrections[lower]) {
        // Preserve capitalization if word was capitalized
        if (word[0] === word[0].toUpperCase()) {
          const fixed = corrections[lower];
          return fixed.charAt(0).toUpperCase() + fixed.slice(1);
        }
        return corrections[lower];
      }
      return word;
    });

    return correctedWords.join("");
  }

}

