import { defineAsyncComponent } from "vue";
import DefaultTheme from "vitepress/theme";
import "./style.css";
import "@gram-lang/renderer/gram.css";

export default {
	extends: DefaultTheme,
	enhanceApp({ app }) {
		app.component(
			"GramPlayground",
			defineAsyncComponent(
				() => import("../../components/playground/GramPlayground.vue"),
			),
		);
	},
};
