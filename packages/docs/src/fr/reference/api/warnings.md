# Avertissements

Une recette malformée ou incomplète compile quand même — le compilateur et l'analyseur collectent des objets `Warning` structurés au lieu de lever des exceptions, afin que les appelants puissent afficher une recette tout en signalant ce qui ne va pas. `WarningCode` et les utilitaires associés sont exportés depuis `@gram-lang/kitchen`.

## L'interface `Warning`

```typescript
interface Warning {
  code: WarningCode;
  message: string;       // lisible par un humain, prêt à être affiché tel quel
  item?: string;
  loc?: { start: number; end: number }; // décalages en caractères dans la source, quand disponible
  section?: string | null;
}
```

`compile()` les retourne dans `CompilationResult.warnings` ; `analyze()` les propage et peut en ajouter d'autres sur le même tableau dans `AnalyzedCompilationResult.warnings`. Jamais une simple chaîne — `.message` est toujours présent.

## Sévérité & `--strict`

```typescript
type WarningSeverity = "error" | "warning" | "info";
const warningSeverity: Record<WarningCode, WarningSeverity>;
```

Les problèmes d'intégrité structurelle — une référence vers quelque chose qui n'existe pas, une collision de noms — sont de sévérité `error`. Tout le reste (lacunes d'estimation nutritionnelle, annotations incomplètes mais valides) est `warning`, si bien qu'une unité de minuteur manquante, par exemple, ne fait pas échouer un build de la même façon qu'une référence indéfinie. C'est exactement la distinction utilisée par l'option `--strict` de `gram check` en CLI : sans `--strict`, seuls les codes de sévérité `error` font échouer la commande ; avec elle, chaque `warning` est promu en `error`. Construisez votre propre logique de mode strict sur `warningSeverity[code]` de la même façon.

## Codes

<!--@include: ../../../reference/api/parts/fr/warning-codes.md-->

### `VARIABLE_NOT_FOUND`
Une quantité relative référence une variable intermédiaire (`50% of &nom`) qui n'a été déclarée comme sortie intermédiaire (`>> nom`) nulle part dans la recette. **Correction** : déclarez la variable avant de la référencer, ou vérifiez une faute de frappe dans le nom.

### `RELATIVE_QUANTITY_UNRESOLVED`
Une quantité relative référence un ingrédient (`50% of @nom`) qui n'est pas apparu plus tôt **dans la même section** — les cibles relatives-à-un-ingrédient sont scopées à la section, contrairement aux variables. **Correction** : déplacez l'ingrédient référencé plus tôt dans la même section, ou référencez plutôt une variable (`&nom`) si c'est censé être valable pour toute la recette.

### `RELATIVE_QUANTITY_UNKNOWN_MASS`
Émis pendant l'analyse : la cible d'une quantité relative a été trouvée, mais sa propre masse n'a pas pu être calculée (aucune unité/densité résolvable), donc le pourcentage ne peut pas être appliqué. **Correction** : donnez à l'ingrédient cible une unité standardisable, ou une entrée densité/`unit_weight` dans la base de données.

### `CIRCULAR_REFERENCE`
La quantité relative d'un ingrédient se cible elle-même (`@farine{50% of @farine}`). **Correction** : supprimez l'auto-référence — une quantité en pourcentage doit cibler un ingrédient ou une variable *différent*.

### `UNDEFINED_REFERENCE`
Une référence nue (`&nom`) ou un ingrédient référençable (`@&nom`) pointe vers quelque chose qui n'a jamais été enregistré plus tôt dans la recette. **Correction** : introduisez l'ingrédient (sans `&`) avant de le référencer, ou vérifiez une faute de frappe.

### `MISSING_UNIT`
Un `Timer` (minuteur) ou une `Temperature` a été écrit sans unité explicite (ex. `~{10}` au lieu de `~{10 min}`). **Correction** : ajoutez une unité explicite.

### `INVALID_UNIT`
Soit un `Timer` a reçu une quantité non numérique (texte), soit une `Temperature` a reçu une unité autre que Celsius/Fahrenheit. **Correction** : utilisez une valeur numérique + une unité reconnue pour les minuteurs ; utilisez `°C` ou `°F` pour les températures.

### `SCOPE_CONFLICT`
Deux sections déclarent le même nom de variable intermédiaire/globale (`>> nom`). Les noms de variable doivent être uniques dans toute la recette, pas seulement au sein d'une section. **Correction** : renommez l'une des deux déclarations.

### `MISSING_INGREDIENT`
Pendant l'estimation nutritionnelle, un ingrédient avec une masse calculable n'a aucune entrée correspondante (par id ou alias) dans la base de données. **Correction** : ajoutez l'ingrédient (ou un alias vers une entrée existante) à votre base de données.

### `MISSING_MACROS`
L'ingrédient existe dans la base de données, mais son entrée n'a pas de bloc `nutrition`. **Correction** : ajoutez un bloc `nutrition` à cette entrée de la base de données.

### `UNKNOWN_MASS`
L'estimation nutritionnelle n'a pas pu calculer de masse du tout pour cet ingrédient (unité non résolvable, aucune densité/`unit_weight`), donc il est exclu des totaux. **Correction** : comme pour `RELATIVE_QUANTITY_UNKNOWN_MASS` — donnez-lui une unité standardisable ou des données physiques dans la base de données.

### `INVALID_MODIFIER_COMBINATION`
Modificateurs conflictuels ou dupliqués sur le même ingrédient/matériel — ex. `optional (?)` avec `important (*)`, `hidden (-)` avec `important (*)`, `hidden (-)` avec `referenceable (&)`, ou le même modificateur deux fois. La combinaison précise est nommée dans `.message`. **Correction** : supprimez le modificateur en conflit.

### `INVALID_BAKERS_REFERENCE`
L'ingrédient marqué comme base du pourcentage boulanger (via le modificateur `*` ou l'option `bakersReference`) a une masse elle-même dérivée de la quantité relative d'un *autre* ingrédient — il ne peut pas aussi servir d'ancre à 100%, ce qui serait circulaire. **Correction** : marquez un autre ingrédient, à quantité absolue (non relative), comme référence.

### `NO_BAKERS_REFERENCE`
Le mode boulanger a été explicitement demandé (`enableBakersMath` avec une recherche `*` nue, ou un id `bakersReference` explicite) mais aucun ingrédient n'a correspondu. **Correction** : marquez un ingrédient avec le modificateur `*`, ou corrigez l'id `bakersReference` pour qu'il corresponde à un ingrédient existant.
