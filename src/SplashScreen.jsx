import React, { useEffect, useState } from "react";
import logo from "./assets/infinix-logo-neon-gta.png";
import "./splash-screen.css";

const SPLASH_DURATION_MS = 4000;
const SPLASH_FADE_OUT_MS = 750;

export default function SplashScreen({ onFinish }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const fadeOutTimer = setTimeout(() => setExiting(true), SPLASH_DURATION_MS - SPLASH_FADE_OUT_MS);
    const finishTimer = setTimeout(() => onFinish?.(), SPLASH_DURATION_MS);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <main className={`splash-screen${exiting ? " splash-screen--exiting" : ""}`} aria-label="Esync Sade Cloud 3">
      <svg className="splash-screen__skyline" viewBox="0 0 1440 560" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id="splash-skyline-neon" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff4bdd" />
            <stop offset="52%" stopColor="#b36dff" />
            <stop offset="100%" stopColor="#55eaff" />
          </linearGradient>
        </defs>
        <g fill="#070611" fillOpacity="0.88" stroke="url(#splash-skyline-neon)" strokeWidth="2">
          <path d="M0 560V350h118v-35h50v35h128v210z" />
          <path d="M250 560V230h54v-34h36v34h124v330z" />
          <path d="M476 560V315h112v-24h46v24h94v245z" />
          <path d="M720 560V172h65V92h18V42h8v50h18v80h66v388z" />
          <path d="M914 560V258h72v-42h32v42h114v302z" />
          <path d="M1132 560V188h72v-30h40v30h118v372z" />
          <path d="M1390 560V334h50v226z" />
        </g>
        <g fill="none" stroke="url(#splash-skyline-neon)" strokeWidth="2" opacity="0.58">
          <path d="M72 383h174M72 427h174M72 471h174M72 515h174M102 350v210M160 350v210M218 350v210" />
          <path d="M326 258h112M326 304h112M326 350h112M326 396h112M326 442h112M326 488h112M354 230v330M412 230v330" />
          <path d="M510 350h180M510 397h180M510 444h180M510 491h180M550 315v245M640 315v245" />
          <path d="M746 202h126M746 250h126M746 298h126M746 346h126M746 394h126M746 442h126M746 490h126M754 172v388M824 172v388M894 172v388" />
          <path d="M954 300h142M954 348h142M954 396h142M954 444h142M954 492h142M982 258v302M1052 258v302" />
          <path d="M1172 230h154M1172 278h154M1172 326h154M1172 374h154M1172 422h154M1172 470h154M1204 188v372M1274 188v372" />
          <path d="M0 560h1440" />
        </g>
        <g className="splash-screen__palms">
          <g>
            <path d="M180 560C177 470 177 371 183 268" />
            <path d="M183 268C132 266 94 246 59 211" />
            <path d="M183 268C123 233 102 195 96 158" />
            <path d="M183 268C156 209 154 166 170 126" />
            <path d="M183 268C191 208 209 163 241 133" />
            <path d="M183 268C223 217 260 196 303 191" />
            <path d="M183 268C231 249 278 253 320 273" />
            <path d="M183 268C144 271 100 290 68 322" />
            <path d="M183 268C146 239 133 213 132 191" />
            <path d="M183 268C205 230 232 213 259 208" />
          </g>
          <g transform="translate(1440 8) scale(-0.92 0.96)">
            <path d="M180 560C177 470 177 371 183 268" />
            <path d="M183 268C132 266 94 246 59 211" />
            <path d="M183 268C123 233 102 195 96 158" />
            <path d="M183 268C156 209 154 166 170 126" />
            <path d="M183 268C191 208 209 163 241 133" />
            <path d="M183 268C223 217 260 196 303 191" />
            <path d="M183 268C231 249 278 253 320 273" />
            <path d="M183 268C144 271 100 290 68 322" />
            <path d="M183 268C146 239 133 213 132 191" />
            <path d="M183 268C205 230 232 213 259 208" />
          </g>
        </g>
      </svg>
      <div className="splash-screen__content">
        <img className="splash-screen__logo" src={logo} alt="Infinix Dev, Solutions that transform" />
        <h1 className="splash-screen__brand">
          <span>Esync Sade</span>
          <span>Cloud III</span>
        </h1>
        <div className="splash-screen__underline" aria-hidden="true" />
        <p className="splash-screen__credit">Arquitecto de soluciones: Ruben Madrigal</p>
      </div>
    </main>
  );
}
