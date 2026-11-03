// Tipos de Expo (entre otros, los de imports de .css y CSS modules).
// `expo-env.d.ts` hace lo mismo, pero lo genera `expo start` y está en el
// .gitignore (como recomienda Expo): en una máquina limpia, como el CI, no
// existe y el typecheck falla. Este archivo sí está en el repo.
/// <reference types="expo/types" />
