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
    TICK_RATE_MS: 300, // Might need to change this!
} as const;

// User input

type Key = "Space";

// State processing

type State = Readonly<{
    gameEnd: boolean;
    birdY: number;
    vy: number;
    lives: number;
}>;

const initialState: State = {
    gameEnd: false,
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
    

    // --- Return function that updates bird each tick ---
    return (s: State & { birdY: number }) => {
        // Update bird Y position based on state
        birdImg.setAttribute("y", `${s.birdY}`);

        // Game over text
        gameOver.setAttribute("visibility", s.gameEnd ? "visible" : "hidden");
        gameOver.textContent = s.gameEnd ? "Game Over!" : "";

        // Placeholder score/lives
        scoreText ? scoreText.textContent = "Score: 0" : null;
        livesText ? livesText.textContent = `Lives: ${s.lives}` : null;
    };
};



// Update State for Bird Movemenent
// Update State for Bird Movement (with pipe collisions + lives)
// Update State for Bird Movement (with pipe collisions + lives)
export const state$ = (
  csvContents: string,
  activePipes: Array<{ pipe: Pipe; topElem: SVGRectElement; bottomElem: SVGRectElement }>
): Observable<State> => {
  /** User input */
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
    flap$.pipe(map(vy => ({ type: "flap", vy }))),
    tick$.pipe(map(() => ({ type: "gravity", vy: 2 })))
  );

  const initialBirdState: State = {
    ...initialState,
    birdY: 200,
    vy: 0,
  };

  return movement$.pipe(
    scan((state: State, event: any) => {
      if (state.gameEnd) return state; // freeze if game over

      // Calculate velocity
      let vy =
        event.type === "flap"
          ? event.vy
          : event.type === "gravity"
          ? state.vy + event.vy
          : state.vy;

      // Update position
      let birdY = state.birdY + vy;

      // Check wall collision
      let gameEnd = birdY < 0 || birdY + Birb.HEIGHT > Viewport.CANVAS_HEIGHT ? true : false;
      let lives = state.lives;

      // Check pipe collisions using ternary style
      for (const { pipe } of activePipes) {
        const collision = isColliding(birdY, pipe);

        collision === "top"
          ? (vy = 5 + Math.random() * 5, birdY += vy, lives -= 1)
          : collision === "bottom"
          ? (vy = -(5 + Math.random() * 5), birdY += vy, lives -= 1)
          : null;

        lives <= 0 ? (gameEnd = true, vy = 0, birdY = Math.max(0, Math.min(Viewport.CANVAS_HEIGHT - Birb.HEIGHT, birdY))) : null;
      }

      return {
        ...state,
        vy,
        birdY,
        lives,
        gameEnd,
      };
    }, initialBirdState),

    map((state: State) => ({
      gameEnd: state.gameEnd,
      vy: state.vy,
      birdY: state.birdY,
      lives: state.lives,
    }))
  );
};



type Pipe = {
    x: number;            // current horizontal position
    gapY: number;         // vertical start of the gap (top of gap)
    pipeGapHeight: number; // height of the gap
};

// Constants 
const GAP_HEIGHT = 100;  // vertical gap height
const PIPE_SPEED = 6;    // pixels per tick
const SPAWN_THRESHOLD = 0.7 * Viewport.CANVAS_WIDTH; // spawn new pipe after previous moves this far


// Creates an initial pipe and continuously spawns new pipes as the previous moves left. (by spawn threshold)
// Pipes are split into top and bottom, with a vertical gap in between.
const animatePipes = (
    svg: SVGSVGElement,
    activePipes: Array<{ pipe: Pipe; topElem: SVGRectElement; bottomElem: SVGRectElement }>
) => {

    // Function to create a new pipe
    const createPipe = () => {
        const minGapY = 20; // minimal y to keep gap on screen
        const maxGapY = Viewport.CANVAS_HEIGHT - GAP_HEIGHT - 20; // max gap in between pipes
        const gapY = minGapY + Math.random() * (maxGapY - minGapY); // puts a random gap of certain size for bird to go through

        // Create a new pipe starting at the right edge of the screen, with a randomly determined vertical gap
        const pipe: Pipe = { x: Viewport.CANVAS_WIDTH, gapY, pipeGapHeight: GAP_HEIGHT };

        // Create top and bottom pipe elements
        const topElem = createSvgElement(svg.namespaceURI, "rect", {
            x: `${pipe.x}`, // Horizontal position of the pipe
            y: "0", // Start at top of canvas
            width: `${Constants.PIPE_WIDTH}`, // Pipe width
            height: `${pipe.gapY}`, // Height from top to start of gap
            fill: "green", // Pipe color
        }) as SVGRectElement; // narrows the type 

        const bottomElem = createSvgElement(svg.namespaceURI, "rect", {
            x: `${pipe.x}`, // Horizontal position
            y: `${pipe.gapY + pipe.pipeGapHeight}`, // Start at bottom of gap
            width: `${Constants.PIPE_WIDTH}`, // Pipe width
            height: `${Viewport.CANVAS_HEIGHT - (pipe.gapY + pipe.pipeGapHeight)}`, // Remaining height to bottom
            fill: "green",  // Pipe color
        }) as SVGRectElement;

        svg.append(topElem, bottomElem); // add both pipes to SVG Canvas
        activePipes.push({ pipe, topElem, bottomElem }); // add to active pipes list, to track.
    };

    /**
     * Collision detection between the bird and a pipe.
     *
     * @param birdY - the bird's vertical position
     * @param pipe - the pipe being checked
     * @returns "top" if hitting the top pipe, "bottom" if hitting the bottom pipe, or null if no collision
     */

    // Spawn first pipe immediately
    createPipe();

    // Animate pipes on each tick
    interval(Constants.TICK_RATE_MS / 2).subscribe(() => {
        // Get current bird Y position from SVG element
        const birdElem = document.querySelector("image") as SVGImageElement;
        const birdY = birdElem?.y.baseVal.value ?? 200; // default to 200 if missing

        // Loop through all active pipes in reverse (so we can safely remove pipes while iterating)
        for (let i = activePipes.length - 1; i >= 0; i--) {
            const { pipe, topElem, bottomElem } = activePipes[i];

            pipe.x -= PIPE_SPEED; // Move pipe left by PIPE_SPEED pixels

            // Update pipe positions on screen, or remove if it has gone off the left side of screen using ternary
            pipe.x + Constants.PIPE_WIDTH > 0
                ? (topElem.setAttribute("x", `${pipe.x}`), // Update the x-position of the top pipe element to match pipe.x
                   bottomElem.setAttribute("x", `${pipe.x}`)) // Update the x-position of the bottom pipe element to match pipe.x
                : (svg.removeChild(topElem), // remove top pipe elem from SVG Canvas
                   svg.removeChild(bottomElem), // remove bottom pipe from SVG Canvas
                   activePipes.splice(i, 1)); // remove the pipe from the active pipes array

            // Collision check each frame using ternary
            const collision = isColliding(birdY, pipe);
        }

        // Spawn a new pipe if there are no pipes, or last pipe has moved past the spawn threshold using ternary
        activePipes.length === 0 || activePipes[activePipes.length - 1].pipe.x < SPAWN_THRESHOLD
            ? createPipe()
            : null; // Do nothing otherwise
    });
};

const isColliding = (birdY: number, pipe: Pipe): "top" | "bottom" | null => {
    const birdTop = birdY;
    const birdBottom = birdY + Birb.HEIGHT;
    const birdX = Viewport.CANVAS_WIDTH * 0.3; // Bird’s fixed horizontal position

    const withinPipeX =
        birdX + Birb.WIDTH / 2 > pipe.x && birdX - Birb.WIDTH / 2 < pipe.x + Constants.PIPE_WIDTH;

    return !withinPipeX
        ? null                      // not overlapping horizontally → no collision
        : birdTop < pipe.gapY
        ? "top"                     // hits top pipe
        : birdBottom > pipe.gapY + pipe.pipeGapHeight
        ? "bottom"                  // hits bottom pipe
        : null;                     // safe inside gap
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
            click$.pipe(
                switchMap(() => {
                    const svg = document.querySelector("#svgCanvas") as SVGSVGElement;

                    // Create pipes and return the activePipes array
                    const activePipes: Array<{ pipe: Pipe; topElem: SVGRectElement; bottomElem: SVGRectElement }> = [];
                    animatePipes(svg, activePipes); // pass the array so state$ can use it

                    // Return the state$ observable with activePipes for collision detection
                    return state$(contents, activePipes);
                })
            )
        )
    ).subscribe(render());
}