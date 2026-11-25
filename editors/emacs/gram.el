;;; Gram recipes in Emacs 29+ with eglot: add this to your init file.

(defvar gram-mode-syntax-table
  (let ((table (make-syntax-table)))
    ;; `//' line comments and `/* */' block comments.
    (modify-syntax-entry ?/ ". 124b" table)
    (modify-syntax-entry ?* ". 23" table)
    (modify-syntax-entry ?\n "> b" table)
    ;; A quote in a recipe is prose, not the start of a string.
    (modify-syntax-entry ?\" "." table)
    table)
  "Syntax table for `gram-mode'.")

(define-derived-mode gram-mode prog-mode "Gram"
  "Major mode for Gram recipes."
  (setq-local comment-start "// ")
  (setq-local comment-end "")
  (setq-local comment-start-skip "//+\\s-*")
  ;; No keywords: font-lock colors the comments only.
  (setq-local font-lock-defaults '(nil)))

(add-to-list 'auto-mode-alist '("\\.gram\\'" . gram-mode))

(with-eval-after-load 'eglot
  (add-to-list 'eglot-server-programs
               ;; No preview panel in Emacs: ask the server for no view.
               '(gram-mode . ("gram-language-server" "--stdio"
                              :initializationOptions (:views :json-false)))))
