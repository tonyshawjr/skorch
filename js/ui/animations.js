// js/ui/animations.js - Card animation utilities

/**
 * Animate an element from one position to another using CSS transforms.
 * @param {HTMLElement} el - Element to animate
 * @param {object} from - {x, y} starting offset
 * @param {object} to - {x, y} ending offset
 * @param {number} duration - milliseconds
 * @returns {Promise} resolves when animation completes
 */
export function animateMove(el, from, to, duration = 300) {
    return new Promise(resolve => {
        el.style.transition = 'none';
        el.style.transform = `translate(${from.x}px, ${from.y}px)`;
        el.style.zIndex = '100';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`;
                el.style.transform = `translate(${to.x}px, ${to.y}px)`;

                setTimeout(() => {
                    el.style.transition = '';
                    el.style.transform = '';
                    el.style.zIndex = '';
                    resolve();
                }, duration);
            });
        });
    });
}

/**
 * Animate a card flip (Y-axis rotation).
 * @param {HTMLElement} el
 * @param {number} duration
 * @returns {Promise}
 */
export function animateFlip(el, duration = 400) {
    return new Promise(resolve => {
        el.style.transition = `transform ${duration}ms ease-in-out`;
        el.style.transformStyle = 'preserve-3d';
        el.classList.add('flipping');

        // First half: rotate to 90deg (edge-on)
        el.style.transform = 'rotateY(90deg)';

        setTimeout(() => {
            // Swap the card face at the halfway point
            el.dispatchEvent(new CustomEvent('flip-halfway'));

            // Second half: rotate back to 0
            el.style.transform = 'rotateY(0deg)';

            setTimeout(() => {
                el.style.transition = '';
                el.style.transform = '';
                el.classList.remove('flipping');
                resolve();
            }, duration / 2);
        }, duration / 2);
    });
}

/**
 * Animate Skorch burn effect on the discard pile.
 * @param {HTMLElement} pileEl - The discard pile container
 * @param {number} duration
 * @returns {Promise}
 */
export function animateBurn(pileEl, duration = 600) {
    return new Promise(resolve => {
        const cards = pileEl.querySelectorAll('.sk-card');
        if (cards.length === 0) { resolve(); return; }

        // Add burn class to each card with staggered delay
        cards.forEach((card, i) => {
            setTimeout(() => {
                card.classList.add('burning');
            }, i * 30);
        });

        // Create fire glow overlay
        const glow = document.createElement('div');
        glow.className = 'burn-glow';
        pileEl.appendChild(glow);

        setTimeout(() => {
            glow.remove();
            resolve();
        }, duration);
    });
}

/**
 * Animate card sliding in (for draw or deal).
 * @param {HTMLElement} el
 * @param {'left'|'right'|'top'|'bottom'} direction
 * @param {number} duration
 * @param {number} delay - stagger delay
 * @returns {Promise}
 */
export function animateSlideIn(el, direction = 'left', duration = 250, delay = 0) {
    return new Promise(resolve => {
        const offsets = {
            left: { x: -120, y: 0 },
            right: { x: 120, y: 0 },
            top: { x: 0, y: -120 },
            bottom: { x: 0, y: 120 }
        };
        const offset = offsets[direction] || offsets.left;

        el.style.opacity = '0';
        el.style.transform = `translate(${offset.x}px, ${offset.y}px)`;

        setTimeout(() => {
            el.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`;
            el.style.opacity = '1';
            el.style.transform = 'translate(0, 0)';

            setTimeout(() => {
                el.style.transition = '';
                el.style.transform = '';
                el.style.opacity = '';
                resolve();
            }, duration);
        }, delay);
    });
}

/**
 * Animate card pop (scale up then back, for playing a card).
 * @param {HTMLElement} el
 * @param {number} duration
 * @returns {Promise}
 */
export function animatePop(el, duration = 200) {
    return new Promise(resolve => {
        el.style.transition = `transform ${duration}ms ease-out`;
        el.style.transform = 'scale(1.15)';
        el.style.zIndex = '100';

        setTimeout(() => {
            el.style.transform = 'scale(1)';
            setTimeout(() => {
                el.style.transition = '';
                el.style.transform = '';
                el.style.zIndex = '';
                resolve();
            }, duration / 2);
        }, duration / 2);
    });
}

/**
 * Animate shake (for invalid plays).
 * @param {HTMLElement} el
 * @param {number} duration
 * @returns {Promise}
 */
export function animateShake(el, duration = 400) {
    return new Promise(resolve => {
        el.classList.add('shaking');
        setTimeout(() => {
            el.classList.remove('shaking');
            resolve();
        }, duration);
    });
}

/**
 * Animate cards being picked up (fan out then collect).
 * @param {HTMLElement} pileEl
 * @param {number} duration
 * @returns {Promise}
 */
export function animatePickup(pileEl, duration = 500) {
    return new Promise(resolve => {
        const cards = pileEl.querySelectorAll('.sk-card');
        if (cards.length === 0) { resolve(); return; }

        // Fan cards out
        cards.forEach((card, i) => {
            const angle = (Math.random() - 0.5) * 30;
            const tx = (Math.random() - 0.5) * 60;
            const ty = (Math.random() - 0.5) * 40;
            card.style.transition = `transform ${duration * 0.4}ms ease-out`;
            card.style.transform = `translate(${tx}px, ${ty}px) rotate(${angle}deg)`;
        });

        // Then collect them (fade out)
        setTimeout(() => {
            cards.forEach(card => {
                card.style.transition = `transform ${duration * 0.4}ms ease-in, opacity ${duration * 0.3}ms ease-in`;
                card.style.transform = 'translate(0, -30px) scale(0.8)';
                card.style.opacity = '0';
            });
        }, duration * 0.5);

        setTimeout(resolve, duration);
    });
}

/**
 * Simple delay utility.
 * @param {number} ms
 * @returns {Promise}
 */
export function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
