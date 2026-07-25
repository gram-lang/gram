import { defineAsyncComponent } from "vue";
import DefaultTheme from "vitepress/theme";
import Mermaid from "vitepress-mermaid-viewer/Mermaid";
import "vitepress-mermaid-viewer/style.css";
import "./style.css";
import "@gram-lang/renderer/gram.css";
import "@gram-lang/renderer/gantt.css";

export default {
	extends: DefaultTheme,
	enhanceApp({ app }) {
		app.component("Mermaid", Mermaid);
		app.component(
			"GramPlayground",
			defineAsyncComponent(
				() => import("../../components/playground/GramPlayground.vue"),
			),
		);
	},
};
