import type { Config } from 'tailwindcss'

/**
 * The brand is lifted, deliberately and fairly precisely, from designjoy.co —
 * the values below were read out of Designjoy's own compiled stylesheet rather
 * than eyeballed from a screenshot, which is why they look so specific.
 *
 *   body            #ece6e8  warm grey-pink, not white
 *   ink             #000000  headings and body copy are actually black
 *   muted           #99948f  the one grey used for secondary copy
 *   hairline        #ddced3  card and outline-button borders
 *   card radius     19px     unusual, and a big part of the look
 *   button radius   8px
 *   headings        Figtree 500 with heavy negative tracking (-3px at 82px)
 *
 * Designjoy is a calm, expensive-looking site. This one is about renting
 * advertising space on a man's backside. Holding the calm typography while the
 * copy misbehaves is the entire joke, so resist the urge to make the design
 * loud — the accents below are seasoning, not the meal.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#ece6e8',
        ink: '#000000',
        muted: '#99948f',
        hairline: '#ddced3',
        hairline2: '#e0d4d8',
        card: '#ffffff',
        // Designjoy's accent set. Orange is our primary "live" signal, pink is
        // for anything sold, gold for the winner, lime for confirmations.
        flame: '#ff5a00',
        hotpink: '#ff0084',
        gold: '#fdd900',
        lime: '#61f15c',
      },
      fontFamily: {
        sans: ['var(--font-figtree)', 'Figtree', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        card: '19px',
        btn: '8px',
        pill: '100vw',
      },
      boxShadow: {
        // Designjoy's filled button: a dark gradient with a 1px inner highlight
        // along the top edge, which is what stops it reading as a flat rectangle.
        btn: '0 1px 2px #0000004d, inset 1px 1px .25px #ffffff4d, inset 0 2px 1px #ffffff80',
        'btn-hover':
          '0 9px 8px #0003, 0 1px 2px #0000004d, inset 1px 1px .25px #ffffff4d, inset 0 2px 1px #ffffff80',
        card: '0 1px 2px #0000000f',
        lift: '0 12px 32px #00000014',
      },
      maxWidth: { container: '1200px' },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(.9)', opacity: '.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        riseIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
funk: { '0%,100%': { transform: 'rotate(-1.2deg)' }, '50%': { transform: 'rotate(1.2deg)' } },
      },
      animation: {
        'pulse-ring': 'pulseRing 2s cubic-bezier(.4,0,.6,1) infinite',
        'rise-in': 'riseIn .35s ease-out both',
        wiggle: 'funk .6s ease-in-out 3',
      },
    },
  },
  plugins: [],
}
export default config
