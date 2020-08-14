module.exports = {
  env: {
    "browser": true,
    "node": true,
    "es6": true
  },
  root: true,
  extends: "eslint:recommended",
  plugins: ["promise"],
  rules: {
    "no-console": "off",
    "max-lines-per-function": [ "error", { "max": 100, "skipComments": true, "skipBlankLines": true } ],
    "max-len": [ "error", { "code": 150, "ignoreStrings": true, "ignoreTemplateLiterals": true, "ignoreComments": true } ],
    "object-curly-spacing": [ "error", "always" ],
    // "max-depth": ["error", 4],
    // "max-statements": ["error", 50],
    "max-nested-callbacks": ["error", 3],
    "no-return-await": [ "error" ],
    // "max-statements-per-line": ["error", { "max": 3 }],
    "require-await": [ "error" ],
    "handle-callback-err": [ "error", "error" ],
    "no-throw-literal": [ "error" ],
    "prefer-promise-reject-errors": [ "error" ],
    //"promise/always-return": "error",
    "promise/no-return-wrap": "error",
    "promise/param-names": "error",
    //"promise/catch-or-return": "error", -- кажется, это надо будет включитть потом
    "promise/no-native": "off",
    //"promise/no-nesting": "warn" -- кажется, это надо будет включитть потом
    //"promise/no-promise-in-callback": "warn",
    "promise/no-callback-in-promise": "warn",
    //"promise/avoid-new": "warn",
    "promise/no-new-statics": "error",
    "promise/no-return-in-finally": "warn",
    "promise/valid-params": "warn"
  }
}
