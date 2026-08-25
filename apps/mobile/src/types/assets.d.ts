// Assets de audio locais (require/import) resolvem para um asset module id (number) via Metro.
// `expo-env.d.ts` (a referencia padrao "expo/types") e gitignorado por convencao do Expo -
// qualquer declaracao customizada precisa viver num arquivo rastreado pelo git, como este.
declare module '*.wav' {
  const value: number;
  export default value;
}
