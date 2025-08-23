/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import {
    Observable,
    catchError,
    filter,
    fromEvent,
    interval,
    map,
    scan,
    switchMap,
    take,
    merge,
} from "rxjs";
import { fromFetch } from "rxjs/fetch";

/** Constants */

const Viewport = {
    CANVAS_WIDTH: 600,
    CANVAS_HEIGHT: 400,
} as const;

const Birb = {
    WIDTH: 42,
    HEIGHT: 30,
} as const;

const Constants = {
    PIPE_WIDTH: 50,
    TICK_RATE_MS: 500, // Might need to change this!
} as const;

// User input

type Key = "Space";

// State processing

type State = Readonly<{
    gameEnd: boolean;
    birdY: number;
    vy: number;
}>;

const initialState: State = {
    gameEnd: false,
    birdY: 200, // Start in the middle of the screen
    vy: 0       // Initial vertical velocity
};

/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
const tick = (s: State) => s;

// Rendering (side effects)

/**
 * Brings an SVG element to the foreground.
 * @param elem SVG element to bring to the foreground
 */
const bringToForeground = (elem: SVGElement): void => {
    elem.parentNode?.appendChild(elem);
};

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "visible");
    bringToForeground(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "hidden");
};

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
    namespace: string | null,
    name: string,
    props: Record<string, string> = {},
): SVGElement => {
    const elem = document.createElementNS(namespace, name) as SVGElement;
    Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
    return elem;
};

const render = (): ((s: State & { birdY: number }) => void) => {
    // Canvas elements
    const gameOver = document.querySelector("#gameOver") as SVGElement;
    const container = document.querySelector("#main") as HTMLElement;

    // Text fields
    const livesText = document.querySelector("#livesText") as HTMLElement;
    const scoreText = document.querySelector("#scoreText") as HTMLElement;

    const svg = document.querySelector("#svgCanvas") as SVGSVGElement;

    svg.setAttribute(
        "viewBox",
        `0 0 ${Viewport.CANVAS_WIDTH} ${Viewport.CANVAS_HEIGHT}`,
    );

    // --- Create bird once ---
    const birdImg = createSvgElement(svg.namespaceURI, "image", {
        href: "assets/birb.png",
        x: `${Viewport.CANVAS_WIDTH * 0.3 - Birb.WIDTH / 2}`,
        y: `${Viewport.CANVAS_HEIGHT / 2 - Birb.HEIGHT / 2}`,
        width: `${Birb.WIDTH}`,
        height: `${Birb.HEIGHT}`,
    });
    svg.appendChild(birdImg);

    // --- Create pipes once ---
    const pipeGapY = 200; // vertical center of the gap
    const pipeGapHeight = 100;

    const pipeTop = createSvgElement(svg.namespaceURI, "rect", {
        x: "150",
        y: "0",
        width: `${Constants.PIPE_WIDTH}`,
        height: `${pipeGapY - pipeGapHeight / 2}`,
        fill: "green",
    });

    const pipeBottom = createSvgElement(svg.namespaceURI, "rect", {
        x: "150",
        y: `${pipeGapY + pipeGapHeight / 2}`,
        width: `${Constants.PIPE_WIDTH}`,
        height: `${Viewport.CANVAS_HEIGHT - (pipeGapY + pipeGapHeight / 2)}`,
        fill: "green",
    });

    svg.appendChild(pipeTop);
    svg.appendChild(pipeBottom);

    // --- Return function that updates bird each tick ---
    return (s: State & { birdY: number }) => {
        // Update bird Y position based on state
        birdImg.setAttribute("y", `${s.birdY}`);

        // Game over text
        gameOver.setAttribute("visibility", s.gameEnd ? "visible" : "hidden");
        gameOver.textContent = s.gameEnd ? "Game Over!" : "";

        // Placeholder score/lives
        livesText ? livesText.textContent = "Lives: 3" : null;
        scoreText ? scoreText.textContent = "Score: 0" : null;
    };
};



// Update State for Bird Movemenent
export const state$ = (csvContents: string): Observable<State> => {
    /** User input */

    // Create an observable for key presses (spacebar to flap)
    const key$ = fromEvent<KeyboardEvent>(document, "keypress");
    const flap$ = key$.pipe(
        filter(({ code }) => code === "Space"),
        map(() => -8) // Flap gives upward velocity
    );

    /** Determines the rate of time steps */
    const tick$ = interval(Constants.TICK_RATE_MS).pipe(
        map(() => 1) // Each tick applies a downward force of gravity (1)
    );

    // Merge flap inputs and gravity ticks
    const movement$ = merge(
        flap$.pipe(map(vy => ({ type: "flap", vy }))), // flap: direct velocity change 
        tick$.pipe(map(() => ({ type: "gravity", vy: 1 }))) // gravity: adds downward velocity (tick will change velocity)
    );

    // Initial state with birdY and vy
    const initialBirdState = {
        ...initialState, // spread operator to keep the initial state of bird
        birdY: 200, // Start in the middle of the screen
        vy: 0 // velocity starts at 0
    };

    return movement$.pipe( // state changes now (over time)
        scan((state: any, event: any) => {
            let vy = state.vy; // vy is state with current velocity
            vy = event.type === "flap"
                ? event.vy // If flap, set upward velocity
            : event.type === "gravity"
                ? vy + event.vy // If gravity, add gravity effect 
                // event.vy = change in velocity coming from gravity event 
                //vy = birds current velocity
            : vy; // Otherwise, keep current velocity
            const newY = state.birdY + vy;

            return {
                ...state, // spread operator to copy all properties of state object in a new object
                birdY: newY, // new position
                vy, // new velocity
                gameEnd: newY < 0 || newY > Viewport.CANVAS_HEIGHT // end game if bird hits top/bottom
            };

        }, initialBirdState), // start from initial bird state
        map((state: any) => ({ // only update what is relevent for next state (where is bird vertically, is the game over?, velocity of bird)
            gameEnd: state.gameEnd, // is game over?
            vy: state.vy, // Keep vy for smoother animations or collisions
            birdY: state.birdY // bird’s vertical position
        }))
    );
};

// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
if (typeof window !== "undefined") {
    const { protocol, hostname, port } = new URL(import.meta.url);
    const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;
    const csvUrl = `${baseUrl}/assets/map.csv`;

    // Get the file from URL
    const csv$ = fromFetch(csvUrl).pipe(
        switchMap(response => {
            if (response.ok) {
                return response.text();
            } else {
                throw new Error(`Fetch error: ${response.status}`);
            }
        }),
        catchError(err => {
            console.error("Error fetching the CSV file:", err);
            throw err;
        }),
    );

    // Observable: wait for first user click
    const click$ = fromEvent(document.body, "mousedown").pipe(take(1));

    csv$.pipe(
        switchMap(contents =>
            // On click - start the game
            click$.pipe(switchMap(() => state$(contents))),
        ),
    ).subscribe(render());
}
