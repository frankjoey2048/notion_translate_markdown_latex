// ==UserScript==
// @name             Notion-Formula-Auto-Conversion-Tool
// @namespace        http://tampermonkey.net/
// @version          1.35 // Added stop conversion feature
// @description      自动公式转换工具 - 简洁悬浮小球，支持更快的拖动响应和悬浮展开（带延迟隐藏），可中途停止转换
// @author           temp
// @match            https://www.notion.so/*
// @grant            GM_addStyle
// @require          https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @downloadURL      https://update.greasyfork.org/scripts/525730/Notion-Formula-Auto-Conversion-Tool.user.js
// @updateURL        https://update.greasyfork.org/scripts/525730/Notion-Formula-Auto-Conversion-Tool.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // Inject CSS styles
    GM_addStyle(`
        /* 悬浮小球 */
        #formula-floating-ball {
            position: fixed;
            top: 50%;
            right: 10px;
            transform: translateY(-50%);
            z-index: 9999;
            display: flex;
            align-items: center;
            cursor: pointer;
            user-select: none;
            transition: all 0.25s ease; /* For non-top/transform properties */
        }

        /* 小球样式 */
        #formula-ball {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.92);
            box-shadow: rgba(15, 15, 15, 0.1) 0px 0px 0px 1px,
                        rgba(15, 15, 15, 0.1) 0px 2px 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #3291ff;
            transition: all 0.25s ease;
        }

        #formula-ball svg {
            width: 18px;
            height: 18px;
            fill: currentColor;
            transition: all 0.25s ease;
        }

        /* 展开样式 */
        #formula-expanded {
            position: absolute;
            right: 42px; /* Distance from the ball */
            padding: 8px 12px;
            border-radius: 6px;
            background: white;
            box-shadow: rgba(15, 15, 15, 0.1) 0px 0px 0px 1px,
                        rgba(15, 15, 15, 0.1) 0px 2px 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px;
            color: #37352f;
            display: flex;
            align-items: center;
            white-space: nowrap;
            opacity: 0;
            transform: translateX(10px);
            pointer-events: none;
            transition: all 0.25s ease;
        }

        #formula-floating-ball.expanded #formula-expanded {
            opacity: 1;
            transform: translateX(0);
            pointer-events: all;
        }

        #formula-floating-ball.expanded #formula-ball {
            background: rgba(255, 255, 255, 0.98);
            box-shadow: rgba(15, 15, 15, 0.1) 0px 0px 0px 1px,
                        rgba(15, 15, 15, 0.2) 0px 3px 6px;
        }

        #formula-count {
            margin-right: 12px;
        }

        #convert-btn {
            background: #f5f5f5;
            border: none;
            border-radius: 4px;
            padding: 4px 10px;
            cursor: pointer;
            font-size: 13px;
            color: #37352f;
            transition: background 0.2s;
            font-weight: 500;
        }

        #convert-btn:hover {
            background: #eaeaea;
        }

        #convert-btn:active {
            background: #e0e0e0;
        }

        #convert-btn.processing {
            pointer-events: none;
            opacity: 0.7;
            background: #eaeaea;
        }

        #formula-floating-ball.active #formula-ball {
            background: #3291ff;
            color: white;
        }

        #progress-overlay {
            position: fixed;
            top: 16px;
            right: 16px;
            background: white;
            border-radius: 8px;
            padding: 12px 16px;
            box-shadow: rgba(15, 15, 15, 0.1) 0px 0px 0px 1px,
                        rgba(15, 15, 15, 0.2) 0px 5px 10px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px;
            max-width: 240px;
            opacity: 0;
            transform: translateY(-8px);
            pointer-events: none;
            transition: opacity 0.2s, transform 0.2s;
        }

        #progress-overlay.visible {
            opacity: 1;
            transform: translateY(0);
            pointer-events: auto; /* Enable interaction with stop button */
        }

        #progress-status {
            margin-bottom: 8px;
            color: #37352f;
        }

        #progress-bar-container {
            height: 4px;
            background: #eee;
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 8px; /* Add space for stop button */
        }

        #progress-bar {
            height: 100%;
            width: 0%;
            background: #3291ff;
            border-radius: 2px;
            transition: width 0.3s ease-out;
        }

        /* Stop button style */
        #stop-btn {
            background: #f5f5f5;
            border: none;
            border-radius: 4px;
            padding: 4px 10px;
            cursor: pointer;
            font-size: 13px;
            color: #ff3232;
            transition: background 0.2s;
            font-weight: 500;
            width: 100%;
            text-align: center;
        }

        #stop-btn:hover {
            background: #eaeaea;
        }

        #stop-btn:active {
            background: #e0e0e0;
        }
    `);

    // Cache DOM elements and state
    let floatingBall, convertBtn, progressOverlay, progressStatus, progressBar, stopBtn;
    let isProcessing = false;
    let formulaCount = 0;
    let shouldStopProcessing = false;

    // --- Dragging related variables ---
    let isDragging = false;
    let dragOffsetY = 0;
    let currentY = 0; // Current animated Y position
    let targetY = 0;  // Target Y position (mouse position)
    let animationFrameId = null;
    // --- MODIFIED: Increased Easing Factor for faster response ---
    const EASING_FACTOR = 0.6; // Adjusted from 0.2 to 0.6 for quicker following

    // Hover related variable
    let hideTimeout = null;

    // Create UI components
    function createUI() {
        if (document.getElementById('formula-floating-ball')) return;

        floatingBall = document.createElement('div');
        floatingBall.id = 'formula-floating-ball';
        floatingBall.innerHTML = `
            <div id="formula-ball">
                <svg viewBox="0 0 16 16">
                    <path d="M14.5,11.5v1c0,0.55-0.45,1-1,1h-11c-0.55,0-1-0.45-1-1v-1c0-0.55,0.45-1,1-1h11C14.05,10.5,14.5,10.95,14.5,11.5z
                             M14.5,7.5v1c0,0.55-0.45,1-1,1h-11c-0.55,0-1-0.45-1-1v-1c0-0.55,0.45-1,1-1h11C14.05,6.5,14.5,6.95,14.5,7.5z M14.5,3.5v1
                             c0,0.55-0.45,1-1,1h-11c-0.55,0-1-0.45-1-1v-1c0-0.55,0.45-1,1-1h11C14.05,2.5,14.5,2.95,14.5,3.5z"/>
                </svg>
            </div>
            <div id="formula-expanded">
                <span id="formula-count">检测中...</span>
                <button id="convert-btn">转换</button>
            </div>
        `;
        document.body.appendChild(floatingBall);

        const initialRect = floatingBall.getBoundingClientRect();
        currentY = initialRect.top;
        targetY = initialRect.top;
        // Set initial position. If CSS transform: translateY(-50%) is used,
        // 'top' should be set considering this.
        // For simplicity, drag start will explicitly set 'top' and remove transform.

        progressOverlay = document.createElement('div');
        progressOverlay.id = 'progress-overlay';
        progressOverlay.innerHTML = `
            <div id="progress-status">准备转换公式</div>
            <div id="progress-bar-container">
                <div id="progress-bar"></div>
            </div>
            <button id="stop-btn">停止转换</button>
        `;
        document.body.appendChild(progressOverlay);

        convertBtn = document.getElementById('convert-btn');
        progressStatus = document.getElementById('progress-status');
        progressBar = document.getElementById('progress-bar');
        stopBtn = document.getElementById('stop-btn');

        convertBtn.addEventListener('click', startConversion);
        stopBtn.addEventListener('click', stopConversion);

        // Expand on hover with delay before hiding
        floatingBall.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
            if (!isDragging) {
                floatingBall.classList.add('expanded');
                updateFormulaCount();
            }
        });

        floatingBall.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(() => {
                floatingBall.classList.remove('expanded');
            }, 300);
        });

        // Dragging event listeners
        floatingBall.addEventListener('mousedown', handleDragStart);
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);

        setTimeout(updateFormulaCount, 1000);
    }

    // Stop conversion process
    function stopConversion() {
        if (!isProcessing) return;
        shouldStopProcessing = true;
        updateStatus('正在停止转换...');
    }

    // Dragging animation loop
    function dragAnimationLoop() {
        // If not dragging and close enough to target, snap to final position and stop animation.
        if (!isDragging && Math.abs(targetY - currentY) < 0.1) {
            floatingBall.style.top = `${targetY.toFixed(1)}px`;
            animationFrameId = null; // Stop the loop
            return;
        }

        // Apply easing: move a fraction of the distance to the target each frame.
        currentY += (targetY - currentY) * EASING_FACTOR;
        floatingBall.style.top = `${currentY.toFixed(1)}px`;

        // Continue the animation loop only if dragging or if not yet at target.
        // This condition is implicitly handled by the first check in the loop.
        // If isDragging is true, it will always continue.
        // If isDragging is false, it continues until currentY is close to targetY.
        animationFrameId = requestAnimationFrame(dragAnimationLoop);
    }

    // Drag handling functions
    function handleDragStart(e) {
        if (e.target.closest('#convert-btn') || e.target.closest('#formula-expanded')) {
            return; // Don't drag if clicking on button or expanded panel
        }
        if (!document.getElementById('formula-ball').contains(e.target)) {
            return; // Only drag by the ball itself
        }

        isDragging = true;
        const rect = floatingBall.getBoundingClientRect(); // Get current position
        dragOffsetY = e.clientY - rect.top;

        // Initialize currentY and targetY from the element's current rendered top position
        currentY = rect.top;
        targetY = rect.top;

        floatingBall.style.cursor = 'grabbing';
        // Switch from transform-based centering to explicit top-based positioning for drag
        floatingBall.style.transform = 'none';
        floatingBall.style.top = `${currentY}px`; // Apply current position immediately

        floatingBall.classList.remove('expanded'); // Hide panel during drag
        clearTimeout(hideTimeout); // Clear any pending hide for the panel

        if (!animationFrameId) { // Start animation loop if not already running
            animationFrameId = requestAnimationFrame(dragAnimationLoop);
        }
        e.preventDefault(); // Prevent text selection
    }

    function handleDragMove(e) {
        if (!isDragging) return;

        const newY = e.clientY - dragOffsetY;
        // Constrain within viewport (with small buffer)
        const maxY = window.innerHeight - floatingBall.offsetHeight - 10; // 10px buffer
        const minY = 10; // 10px buffer

        targetY = Math.max(minY, Math.min(maxY, newY));

        // Ensure animation loop is running if it somehow stopped
        if (!animationFrameId) {
           currentY = parseFloat(floatingBall.style.top) || targetY; // Re-sync currentY
           animationFrameId = requestAnimationFrame(dragAnimationLoop);
        }
    }

    function handleDragEnd() {
        if (isDragging) {
            floatingBall.style.cursor = 'pointer';
            isDragging = false;
            // Animation loop will continue to smoothly settle the ball to targetY
            // If mouse is still over floatingBall, mouseenter will handle re-expansion.
        }
    }

    function updateFormulaCount() {
        const countElement = document.getElementById('formula-count');
        if (!countElement) return;
        formulaCount = 0;

        // Optimize by using a single selector and caching the results
        const editors = document.querySelectorAll('[contenteditable="true"]');
        const mainContentDivs = document.querySelectorAll('div[aria-label="开始输入以编辑文本"]');

        if (mainContentDivs.length > 0) {
            mainContentDivs.forEach(mainDiv => {
                const text = mainDiv.textContent;
                const formulas = findFormulas(text);
                formulaCount += formulas.length;
            });
        } else {
            for (const editor of editors) {
                if (!editor.closest('.notion-overlay-container')) {
                    const text = editor.textContent;
                    const formulas = findFormulas(text);
                    formulaCount += formulas.length;
                }
            }
        }
        countElement.textContent = `检测到 ${formulaCount} 个公式`;
    }

    // Start conversion process
    function startConversion() {
        if (isProcessing) return;
        isProcessing = true;
        shouldStopProcessing = false; // Reset stop flag
        convertBtn.classList.add('processing');
        convertBtn.textContent = '处理中';
        floatingBall.classList.add('active');
        showProgressOverlay();
        convertFormulas().then(() => {
            convertBtn.classList.remove('processing');
            convertBtn.textContent = '转换';
            floatingBall.classList.remove('active');
            isProcessing = false;
            setTimeout(hideProgressOverlay, 3000);
            setTimeout(updateFormulaCount, 1000);
        });
    }

    // Show/hide progress overlay
    function showProgressOverlay() {
        progressOverlay.classList.add('visible');
        updateProgress(0, 1);
    }

    function hideProgressOverlay() {
        progressOverlay.classList.remove('visible');
    }

    // Update progress information
    function updateProgress(current, total) {
        const percentage = total > 0 ? (current / total) * 100 : 0;
        progressBar.style.width = `${percentage}%`;
    }

    function updateStatus(text) {
        progressStatus.textContent = text;
        console.log('[Notion Formula]', text);
    }

    // Find formulas with optimized regex
    function findFormulas(text) {
        if (!text) return [];

        const formulas = [];
        const combinedRegex = /\$\$(.*?)\$\$|\$([^\$\n]+?)\$|\\\((.*?)\\\)|\\\[(.*?)\]\\/gs;
        let match;
        while ((match = combinedRegex.exec(text)) !== null) {
            const [fullMatch, blockFormula_$$ , inlineFormula_$, latexFormula_paren, latexFormula_bracket] = match;
            if (fullMatch) {
                let type = 'unknown';
                let content = '';
                if (blockFormula_$$ !== undefined) {
                    type = 'block_$$';
                    content = blockFormula_$$;
                } else if (inlineFormula_$ !== undefined) {
                    type = 'inline_$';
                    content = inlineFormula_$;
                } else if (latexFormula_paren !== undefined) {
                    type = 'inline_paren';
                    content = latexFormula_paren;
                } else if (latexFormula_bracket !== undefined) {
                    type = 'block_bracket';
                    content = latexFormula_bracket;
                }
                formulas.push({
                    fullMatch: fullMatch,
                    content: content ? content.trim() : '',
                    type: type,
                    index: match.index
                });
            }
        }
        return formulas;
    }

    // Delay function
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Main function to convert all formulas
    async function convertFormulas() {
        updateStatus('扫描文档中...');
        const formulasToProcess = [];

        // Optimize selectors and cache results
        const editors = document.querySelectorAll('[contenteditable="true"]');
        const mainContentDivs = document.querySelectorAll('div[aria-label="开始输入以编辑文本"]');

        if (mainContentDivs.length > 0) {
            mainContentDivs.forEach(mainDiv => {
                const mainDivEditors = mainDiv.querySelectorAll('[contenteditable="true"]');
                mainDivEditors.forEach(editor => {
                    if (!editor.closest('.notion-overlay-container')) {
                        const text = editor.textContent;
                        const formulas = findFormulas(text);
                        if (formulas.length > 0) {
                            formulas.forEach(formula => {
                                formulasToProcess.push({ editor, formulaObject: formula });
                            });
                        }
                    }
                });
            });
        } else {
            for (const editor of editors) {
                if (!editor.closest('.notion-overlay-container')) {
                    const text = editor.textContent;
                    const formulas = findFormulas(text);
                    if (formulas.length > 0) {
                        formulas.forEach(formula => {
                            formulasToProcess.push({ editor, formulaObject: formula });
                        });
                    }
                }
            }
        }

        const validFormulas = [];
        for (let i = 0; i < formulasToProcess.length; i++) {
            const { editor, formulaObject } = formulasToProcess[i];
            if (editor && editor.textContent && editor.textContent.includes(formulaObject.fullMatch)) {
                validFormulas.push(formulasToProcess[i]);
            }
        }

        const totalFormulas = validFormulas.length;
        if (totalFormulas === 0) {
            updateStatus('未找到需要转换的公式');
            return;
        }
        updateStatus(`找到 ${totalFormulas} 个公式，开始转换...`);
        updateProgress(0, totalFormulas);
        let successCount = 0;
        let failCount = 0;

        // Process formulas in reverse order (typically from bottom to top in the document)
        for (let i = validFormulas.length - 1; i >= 0; i--) {
            // Check if we should stop processing
            if (shouldStopProcessing) {
                updateStatus(`已停止: 成功 ${successCount}/${totalFormulas - failCount} (共 ${totalFormulas})`);
                return;
            }

            const { editor, formulaObject } = validFormulas[i];
            const currentIndex = totalFormulas - i;
            updateStatus(`正在转换公式 (${currentIndex}/${totalFormulas})`);
            const success = await convertSingleFormula(editor, formulaObject);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
            updateProgress(currentIndex, totalFormulas);
            await sleep(500);
        }
        updateStatus(`完成: 成功 ${successCount}/${totalFormulas}`);
    }

    // Convert a single formula
    async function convertSingleFormula(editor, formulaObject) {
        const { fullMatch, content, type } = formulaObject;
        try {
            // Check if we should stop processing before each formula conversion
            if (shouldStopProcessing) {
                return false;
            }

            const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
            let targetNode = null;
            let startOffset = -1;
            let currentNode;
            while (currentNode = walker.nextNode()) {
                startOffset = currentNode.textContent.indexOf(fullMatch);
                if (startOffset !== -1) {
                    targetNode = currentNode;
                    break;
                }
            }
            if (!targetNode) {
                console.warn("Target node for formula not found:", fullMatch);
                return false;
            }
            const range = document.createRange();
            range.setStart(targetNode, startOffset);
            range.setEnd(targetNode, startOffset + fullMatch.length);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            targetNode.parentElement.focus({ preventScroll: true });
            document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            await sleep(400);

            // Check for stop after each delay
            if (shouldStopProcessing) return false;

            const area = await findOperationArea();
            if (!area) {
                console.warn("Operation area not found.");
                selection.removeAllRanges();
                pressEscape();
                return false;
            }

            // Check for stop after each major step
            if (shouldStopProcessing) {
                pressEscape();
                return false;
            }

            const formulaButton = await findButton(area, {
                hasSvg: true,
                svgClass: 'equation',
                buttonText: ['equation', '公式', 'math'],
                attempts: 30,
                delay: 120,
                shouldStop: () => shouldStopProcessing
            });

            if (!formulaButton) {
                console.warn("Formula button not found.");
                selection.removeAllRanges();
                pressEscape();
                return false;
            }

            if (shouldStopProcessing) {
                pressEscape();
                return false;
            }

            await simulateClick(formulaButton);
            await sleep(800);

            if (shouldStopProcessing) {
                pressEscape();
                return false;
            }

            const editorInputArea = await findEditorInput(area);
            if (!editorInputArea) {
                console.warn("Formula editor input area not found.");
                pressEscape();
                return false;
            }

            if (shouldStopProcessing) {
                pressEscape();
                return false;
            }

            editorInputArea.focus({ preventScroll: true });
            if (editorInputArea.matches('[contenteditable="true"]')) {
                editorInputArea.textContent = '';
                editorInputArea.textContent = content;
            } else if (editorInputArea.matches('textarea')) {
                editorInputArea.value = '';
                editorInputArea.value = content;
            } else {
                editorInputArea.textContent = '';
                editorInputArea.textContent = content;
            }
            editorInputArea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            await sleep(50);

            if (shouldStopProcessing) {
                pressEscape();
                return false;
            }

            simulateTyping(editorInputArea);
            await sleep(50);

            if (shouldStopProcessing) {
                pressEscape();
                return false;
            }

            let doneButtonElement = null;
            for (let attempt = 0; attempt < 40; attempt++) {
                if (shouldStopProcessing) {
                    pressEscape();
                    return false;
                }

                const currentDoneButton = await findButton(area, {
                    buttonText: ['done', '完成'],
                    shouldStop: () => shouldStopProcessing
                });

                if (currentDoneButton) {
                    const isDisabled = currentDoneButton.getAttribute('aria-disabled') === 'true' ||
                                     currentDoneButton.disabled;
                    if (!isDisabled) {
                        doneButtonElement = currentDoneButton;
                        break;
                    }
                }
                await sleep(150);
            }

            if (!doneButtonElement) {
                console.warn("Done button not found or remained disabled.");
                pressEscape();
                return false;
            }

            if (shouldStopProcessing) {
                pressEscape();
                return false;
            }

            await simulateClick(doneButtonElement);
            await sleep(600);
            return true;
        } catch (error) {
            console.error("Error in convertSingleFormula:", error, "for formula:", fullMatch);
            pressEscape();
            return false;
        }
    }

    // Press Escape key
    function pressEscape() {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        setTimeout(() => {
            document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true, cancelable: true }));
        }, 50);
    }

    // Simulate typing
    async function simulateTyping(element) {
        element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        await sleep(20);
        element.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
        await sleep(20);
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
        await sleep(20);
        element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', bubbles: true, cancelable: true }));
        element.dispatchEvent(new FocusEvent('blur', { bubbles: true, cancelable: true }));
        await sleep(50);
        element.dispatchEvent(new FocusEvent('focus', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }

    // Find operation area
    async function findOperationArea() {
        const selector = '.notion-overlay-container';
        for (let i = 0; i < 30; i++) {
            if (shouldStopProcessing) return null;

            const areas = document.querySelectorAll(selector);
            const area = Array.from(areas).find(a =>
                a.style.display !== 'none' &&
                a.querySelector('[role="button"]') &&
                a.offsetWidth > 0 &&
                a.offsetHeight > 0
            );
            if (area) return area;
            await sleep(100);
        }
        return null;
    }

    // Find button with stop check
    async function findButton(area, options = {}) {
        const {
            buttonText = [],
            hasSvg = false,
            svgClass = 'equation',
            attempts = 30,
            delay = 100,
            shouldStop = () => false
        } = options;

        for (let i = 0; i < attempts; i++) {
            // Check if we should stop
            if (shouldStop()) return null;

            const buttons = area.querySelectorAll('[role="button"]');
            const button = Array.from(buttons).find(btn => {
                if (hasSvg && btn.querySelector(`svg.${svgClass}`)) {
                    return true;
                }
                if (buttonText.length > 0) {
                    const text = btn.textContent.toLowerCase();
                    if (buttonText.some(t => text.includes(t.toLowerCase()))) {
                        return true;
                    }
                }
                return false;
            });
            if (button) return button;
            await sleep(delay);
        }
        return null;
    }

    // Find editor input area
    async function findEditorInput(area) {
        // Check if we should stop
        if (shouldStopProcessing) return null;

        const selectors = [
            'div[contenteditable="true"][role="textbox"][data-content-editable-leaf="true"]',
            'div[contenteditable="true"][placeholder="E = mc^2"]',
            'textarea[placeholder="E = mc^2"]',
            'div.notranslate[contenteditable="true"][data-content-editable-leaf="true"]',
            '.notion-formula-editor div[contenteditable="true"]',
            '.notion-formula-popover div[contenteditable="true"]',
            'div[aria-label*="LaTeX" i][contenteditable="true"]',
            'textarea[aria-label*="LaTeX" i]',
            '.notion-formula-editor [contenteditable="true"]',
            '.notion-formula-editor textarea',
            '[data-placeholder="Enter LaTeX"]',
            'textarea[data-placeholder="Enter LaTeX"]',
            '.notion-selectable-force-within > div[contenteditable="true"]'
        ];

        // Try all selectors at once to reduce waiting
        for (const selector of selectors) {
            const inputElement = area.querySelector(selector);
            if (inputElement && inputElement.offsetWidth > 0 && inputElement.offsetHeight > 0) {
                return inputElement;
            }
        }

        // Fallback options
        let fallbackInput = area.querySelector('div[contenteditable="true"]:not([style*="display: none"])');
        if (fallbackInput && fallbackInput.offsetWidth > 0 && fallbackInput.offsetHeight > 0) return fallbackInput;

        fallbackInput = area.querySelector('textarea:not([style*="display: none"])');
        if (fallbackInput && fallbackInput.offsetWidth > 0 && fallbackInput.offsetHeight > 0) return fallbackInput;

        return null;
    }

    // Simulate click
    async function simulateClick(element) {
        if (!element) return;

        // Check if we should stop before simulating click
        if (shouldStopProcessing) return;

        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const events = [
            new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY }),
            new MouseEvent('mouseenter', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY }),
            new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY }),
            new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY }),
            new MouseEvent('click', { bubbles: true, cancelable: true, clientX: centerX, clientY: centerY })
        ];

        for (const event of events) {
            // Check if we should stop during click sequence
            if (shouldStopProcessing) return;

            element.dispatchEvent(event);
            await sleep(30);
        }
    }

    // Observe DOM changes with debounce to improve performance
    let lastObserverRun = 0;
    const observerDebounceTime = 1000; // 1 second debounce

    const observer = new MutationObserver(() => {
        const now = Date.now();
        if (now - lastObserverRun > observerDebounceTime) {
            lastObserverRun = now;
            if (!document.getElementById('formula-floating-ball')) {
                createUI();
            }
        }
    });

    // Start observer
    setTimeout(() => {
        createUI();
        const target = document.querySelector('.notion-app-inner') || document.body;
        observer.observe(target, { childList: true, subtree: true });
    }, 1000);

    console.log('Notion公式转换工具已加载 (v1.35 - 悬浮小球+更快的拖动响应+悬浮展开(延迟隐藏)+中途停止功能)');
})();