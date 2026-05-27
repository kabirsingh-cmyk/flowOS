// FlowOS Reach — global setup (transitional)
// This MUST be imported before any other app/*.jsx file so that
// globalThis.React and globalThis.ReactDOM are defined before legacy
// files destructure hooks from them.

import React from 'react'
import * as ReactDOM from 'react-dom/client'

globalThis.React = React
globalThis.ReactDOM = ReactDOM
