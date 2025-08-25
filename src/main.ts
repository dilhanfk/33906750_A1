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
    TICK_RATE_MS: 40, // Might need to change this!
} as const;

// User input

type Key = "Space";

// State processing

type State = Readonly<{
    gameEnd: boolean; // Whether game ended
    birdY: number; // Bird vertical position
    vy: number; // Bird vertical velocity
    lives: number;
}>;

// Initial state
const initialState: State = {
    gameEnd: false, // Game not ended
    birdY: 200, // Start in the middle of the screen
    vy: 0,       // Initial vertical velocity
    lives: 3, // start with 3 lives
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
    elem.parentNode?.appendChild(elem); // Append to parent to bring to front
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

// RENDERING
const render = (): ((s: State & { birdY: number }) => void) => {
    // Canvas elements
    const container = document.querySelector("#main") as HTMLElement; // Container element

    // Text fields
    const livesText = document.querySelector("#livesText") as HTMLElement; // Lives text
    const scoreText = document.querySelector("#scoreText") as HTMLElement; // Score text
    const svg = document.querySelector("#svgCanvas") as SVGSVGElement;

    svg.setAttribute(
        "viewBox",
        `0 0 ${Viewport.CANVAS_WIDTH} ${Viewport.CANVAS_HEIGHT}`,
    );

    // Create bird once
    const birdImg = createSvgElement(svg.namespaceURI, "image", {
        href: "assets/birb.png",
        x: `${Viewport.CANVAS_WIDTH * 0.3 - Birb.WIDTH / 2}`,
        y: `${Viewport.CANVAS_HEIGHT / 2 - Birb.HEIGHT / 2}`,
        width: `${Birb.WIDTH}`,
        height: `${Birb.HEIGHT}`,
    });
    svg.appendChild(birdImg);

    // Game Over text element (will be appended once when game ends)
    let gameOver: SVGTextElement | null = null; 
    
    // Return function that updates bird each tick
    return (s: State & { birdY: number }) => {
        // Update bird Y position based on state
        birdImg.setAttribute("y", `${s.birdY}`);

        // Update score and lives text
        scoreText ? scoreText.textContent = "Score: 0" : null;
        livesText ? livesText.textContent = `Lives: ${s.lives}` : null;

        // If game ended, create Game Over text if it doesn't exist yet
        s.gameEnd
            ? (gameOver
                ? null
                : (() => {
                    gameOver = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    gameOver.setAttribute("x", "50%");
                    gameOver.setAttribute("y", "50%");
                    gameOver.setAttribute("text-anchor", "middle");
                    gameOver.setAttribute("dominant-baseline", "middle");
                    gameOver.setAttribute("font-size", "48");
                    gameOver.setAttribute("fill", "red");
                    gameOver.textContent = "GAME OVER";
                    svg.appendChild(gameOver!);
                })())
            : null;
    };
};

// --- Pipe Types ---
type Pipe = {
    x: number;            // current horizontal position
    gapY: number;         // vertical start of the gap (top of gap)
    pipeGapHeight: number; // height of the gap
};

// Constants 
const GAP_HEIGHT = 100;  
const PIPE_SPEED = 2.5;    
const SPAWN_THRESHOLD = 0.7 * Viewport.CANVAS_WIDTH; // spawn new pipe after previous moves this far

// animate the pipes
const animatePipes = (svg: SVGSVGElement) => {
    const activePipes: Array<{ pipe: Pipe; topElem: SVGRectElement; bottomElem: SVGRectElement }> = [];

    // Create a new pipe
    const createPipe = () => {
        const minGapY = 20; // Minimum gap Y
        const maxGapY = Viewport.CANVAS_HEIGHT - GAP_HEIGHT - 20; // min gap between the pipes
        const gapY = minGapY + Math.random() * (maxGapY - minGapY); // Random gap position

        const pipe: Pipe = { x: Viewport.CANVAS_WIDTH, gapY, pipeGapHeight: GAP_HEIGHT }; // New pipe
        
        // Top pipe element
        const topElem = createSvgElement(svg.namespaceURI, "rect", {
            x: `${pipe.x}`, // X position of the top pipe
            y: "0", // Y position starts at top of canvas
            width: `${Constants.PIPE_WIDTH}`, // Width of the pipe
            height: `${pipe.gapY}`, // Height from top to start of the gap
            fill: "green", // Color of the pipe
        }) as SVGRectElement;

        // Bottom pipe element (matches top pipe above)
        const bottomElem = createSvgElement(svg.namespaceURI, "rect", {
            x: `${pipe.x}`,
            y: `${pipe.gapY + pipe.pipeGapHeight}`,
            width: `${Constants.PIPE_WIDTH}`,
            height: `${Viewport.CANVAS_HEIGHT - (pipe.gapY + pipe.pipeGapHeight)}`,
            fill: "green",
        }) as SVGRectElement;

        svg.append(topElem, bottomElem); // Append both pipes
        activePipes.push({ pipe, topElem, bottomElem }); // Add to active pipes
    };

    // Collision detection function: returns "top", "bottom" or null if no collision
    const isColliding = (birdY: number, pipe: Pipe): "top" | "bottom" | null => {
        const birdTop = birdY; // Bird's top Y coordinate
        const birdBottom = birdY + Birb.HEIGHT; // Bird's bottom Y coordinate
        const birdLeft = Viewport.CANVAS_WIDTH * 0.3; // Bird's left X coordinate (fixed horizontal)
        const birdRight = birdLeft + Birb.WIDTH; // Bird's right X coordinate

        // Check if bird is horizontally overlapping the pipe
        const withinPipeX = birdRight > pipe.x ? (birdLeft < pipe.x + Constants.PIPE_WIDTH ? true : false) : false;

        // Determine collision based on bird position relative to pipe gap
        return !withinPipeX ? null // Not horizontally overlapping then no collision
            : birdTop < pipe.gapY ? "top" // Bird's head above gap then hits top pipe
            : birdBottom > pipe.gapY + pipe.pipeGapHeight ? "bottom" // Bird's bottom below gap then hits bottom pipe
            : null; // no collide
    };

    // Reset pipes after collision
    const resetPipes = () => activePipes.length > 0
        ? (activePipes.forEach(({ topElem, bottomElem }) => (svg.removeChild(topElem), svg.removeChild(bottomElem))), // Remove SVG elements
           activePipes.splice(0, activePipes.length), // Clear array
           createPipe()) // Spawn first pipe again
        : createPipe(); // else just spawn the pipe again

    // Spawn first pipe
    createPipe();

    // Animate pipes on an interval (tick)
    interval(Constants.TICK_RATE_MS / 2).subscribe(() => {
        const birdElem = document.querySelector("image") as SVGImageElement;
        const birdY = birdElem?.y.baseVal.value ?? 200;

        const lives = parseInt((document.querySelector("#livesText") as HTMLElement)?.textContent?.replace("Lives: ", "") ?? "3");
        if (lives <= 0) {
            return;
        }
        // Iterate backwards through active pipes (to safely remove offscreen pipes)
        for (let i = activePipes.length - 1; i >= 0; i--) {
            const { pipe, topElem, bottomElem } = activePipes[i];

            pipe.x -= PIPE_SPEED; // Move pipe left by PIPE_SPEED pixels

            pipe.x + Constants.PIPE_WIDTH > 0 // Update pipe positions or remove if offscreen
                ? (topElem.setAttribute("x", `${pipe.x}`), bottomElem.setAttribute("x", `${pipe.x}`)) // Update positions
                : (svg.removeChild(topElem), svg.removeChild(bottomElem), activePipes.splice(i, 1)); // Remove offscreen pipes

            isColliding(birdY, pipe) ? null : null; // collision handled in state$ // place hold
        }

        // Spawn new pipe if no pipes or last pipe has passed spawn threshold
        if (activePipes.length === 0 || activePipes[activePipes.length - 1].pipe.x < SPAWN_THRESHOLD) {
            createPipe();
        }
    });

    // Return active pipes, reset function, and collision checker for state$
    return { activePipes, resetPipes, isColliding };
};

// Update state
export const state$ = (
  csvContents: string, // leave blank
  animatePipesReturn: ReturnType<typeof animatePipes> // Return object containing pipes
): Observable<State> => {
    
  const { activePipes, resetPipes, isColliding } = animatePipesReturn; // Grabs returned values from animatePipes

  // Observable of all keypress events
  const key$ = fromEvent<KeyboardEvent>(document, "keypress");

  // Filter keypresses to only Space key, and map to a flap velocity
  const flap$ = key$.pipe(filter(({ code }) => code === "Space"), map(() => -12));

  // Interval observable for gravity ticks
  const tick$ = interval(Constants.TICK_RATE_MS).pipe(map(() => 1));

  // Merge flap and gravity events into one movement stream
  const movement$ = merge(
    flap$.pipe(map(vy => ({ type: "flap", vy }))), // Flap event with velocity
    tick$.pipe(map(() => ({ type: "gravity", vy: 2 }))) // Gravity event with velocity
  );

  const initialBirdState: State = { ...initialState, birdY: 200, vy: 0 };

  // Process the movement stream to update game state
  return movement$.pipe(
    scan((state: State, event: any) => { 
        //state is accumed state of bird over time
        // will take in more possible events
        // If the game has ended, do nothing (early return)
        if (state.gameEnd) return state;

        // Determine vertical velocity based on event type
        const vy = event.type === "flap" ? event.vy
                 : event.type === "gravity" ? state.vy + event.vy
                 : state.vy;

         // Update bird's vertical position
        const birdY = state.birdY + vy;

        // Track current lives
        let lives = state.lives;
        let gameEnd = state.lives <= 0 

        // Check collision with top/bottom screen
        let newBirdY = birdY;
        if (birdY < 0 || birdY + Birb.HEIGHT > Viewport.CANVAS_HEIGHT) {
            lives -= 1;
            resetPipes();
            newBirdY = 200;
            gameEnd = lives <= 0 ? true : false;
        }
        // Iterate over all active pipes to check for collisions
        for (const { pipe } of activePipes) {
            const collision = isColliding(newBirdY, pipe);
            // Check if bird collides with this pipe
            if (collision) {
                lives -= 1; // Subtract a life on collision
                gameEnd = lives <= 0 ? true : gameEnd; // End game if no lives left
                resetPipes(); // Reset all pipes
                return { ...state, birdY: 200, vy: 0, lives, gameEnd }; // Reset bird position and velocity
            }
        }
        // Return updated state including new position, velocity, lives, and game end bool
        return { ...state, vy, birdY: newBirdY, lives, gameEnd };
    }, initialBirdState), // scan update state to inital bird state

    
    // Map final state to relevant properties for rendering
    map(state => ({ gameEnd: state.gameEnd, vy: state.vy, birdY: state.birdY, lives: state.lives }))
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
        switchMap(response => response.ok ? response.text() : Promise.reject(`Fetch error: ${response.status}`)),
        catchError(err => { console.error("Error fetching the CSV file:", err); throw err; }),
    );

    // Observable: wait for first user click
    const click$ = fromEvent(document.body, "mousedown").pipe(take(1));

    csv$.pipe(
        switchMap(contents =>
            click$.pipe(switchMap(() => {
                // Create pipes and return the activePipes array
                const activePipes: Array<{ pipe: Pipe; topElem: SVGRectElement; bottomElem: SVGRectElement }> = []; // place holder, decided to declare in Pipe type
                const pipes = animatePipes(document.querySelector("#svgCanvas") as SVGSVGElement); 
                // Return the state$ observable with activePipes for collision detection
                return state$(contents, pipes);
            })),
        ),
    ).subscribe(render());
}
