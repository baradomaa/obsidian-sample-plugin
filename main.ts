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
	miniscule: "minuscule",
	ocassion: "occasion",
	pharoah: "pharaoh",
	publically: "publicly",
	independant: "independent",
	judgement: "judgment",
	congradulations: "congratulations",
	supercede: "supersede",
	irresistable: "irresistible",
	maintanence: "maintenance",
	privelege: "privilege",
	begining: "beginning",
	bussiness: "business",
	wierd: "weird",
	truely: "truly",
	alot: "a lot",
	alltogether: "altogether",
	untill: "until",
	liason: "liaison",
	adress: "address",
	calender: "calendar",
	existance: "existence",
	foriegn: "foreign",
	goverment: "government",
	harrass: "harass",
	hierachy: "hierarchy",
	mischevious: "mischievous",
	noticable: "noticeable",
	perseverence: "perseverance",
	preceed: "precede",
	succesfully: "successfully",
	tommorow: "tomorrow",
	unforseen: "unforeseen",
	vaccum: "vacuum",
	writen: "written",
	curiousity: "curiosity",
	familar: "familiar",
	guage: "gauge",
	heirarchy: "hierarchy",
	knowlege: "knowledge",
	millenium: "millennium",
	possesion: "possession",
	reccommend: "recommend",
	ridiculous: "ridiculous",
	sissors: "scissors",
	streighth: "strength",
	thourough: "thorough",
	tounge: "tongue"
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
		editor.on("change", (instance, change) => {
			if (!change.origin || change.origin === "setValue") return;

			const lastChar = change.text.join("").slice(-1);
			const triggerChars = [" ", ".", ",", "!", "?", "\n"];
			if (!triggerChars.includes(lastChar)) return;

			const cursor = editor.getCursor();
			const line = editor.getLine(cursor.line);
			const words = line.slice(0, cursor.ch).split(/\b/);
			const lastWord = words[words.length - 2]; // before punctuation

			if (!lastWord) return;

			const start = { line: cursor.line, ch: line.lastIndexOf(lastWord) };
			const end = { line: cursor.line, ch: start.ch + lastWord.length };

			const corrected = autocorrectText(lastWord);
			if (corrected !== lastWord) {
				editor.replaceRange(corrected, start, end);
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
		});
	}
}
