// ==UserScript==
// @name             Notion-Formula-Auto-Conversion-Tool-Improved
// @namespace        http://tampermonkey.net/
// @version          1.40
// @description      自动公式转换工具 - 修复跨节点公式识别问题
// @author           temp
// @match            https://www.notion.so/*
// @grant            GM_addStyle
// @require          https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Inject CSS styles (保持原有样式)
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
            transition: all 0.25s ease;
        }

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

        #formula-expanded {
            position: absolute;
            right: 42px;
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
            pointer-events: auto;
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
            margin-bottom: 8px;
        }

        #progress-bar {
            height: 100%;
            width: 0%;
            background: #3291ff;
            border-radius: 2px;
            transition: width 0.3s ease-out;
        }

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

    // Dragging related variables
    let isDragging = false;
    let dragOffsetY = 0;
    let currentY = 0;
    let targetY = 0;
    let animationFrameId = null;
    const EASING_FACTOR = 0.6;
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
        if (!isDragging && Math.abs(targetY - currentY) < 0.1) {
            floatingBall.style.top = `${targetY.toFixed(1)}px`;
            animationFrameId = null;
            return;
        }
        currentY += (targetY - currentY) * EASING_FACTOR;
        floatingBall.style.top = `${currentY.toFixed(1)}px`;
        animationFrameId = requestAnimationFrame(dragAnimationLoop);
    }

    // Drag handling functions
    function handleDragStart(e) {
        if (e.target.closest('#convert-btn') || e.target.closest('#formula-expanded')) {
            return;
        }
        if (!document.getElementById('formula-ball').contains(e.target)) {
            return;
        }

        isDragging = true;
        const rect = floatingBall.getBoundingClientRect();
        dragOffsetY = e.clientY - rect.top;
        currentY = rect.top;
        targetY = rect.top;

        floatingBall.style.cursor = 'grabbing';
        floatingBall.style.transform = 'none';
        floatingBall.style.top = `${currentY}px`;
        floatingBall.classList.remove('expanded');
        clearTimeout(hideTimeout);

        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(dragAnimationLoop);
        }
        e.preventDefault();
    }

    function handleDragMove(e) {
        if (!isDragging) return;

        const newY = e.clientY - dragOffsetY;
        const maxY = window.innerHeight - floatingBall.offsetHeight - 10;
        const minY = 10;

        targetY = Math.max(minY, Math.min(maxY, newY));

        if (!animationFrameId) {
           currentY = parseFloat(floatingBall.style.top) || targetY;
           animationFrameId = requestAnimationFrame(dragAnimationLoop);
        }
    }

    function handleDragEnd() {
        if (isDragging) {
            floatingBall.style.cursor = 'pointer';
            isDragging = false;
        }
    }

    function updateFormulaCount() {
        const countElement = document.getElementById('formula-count');
        if (!countElement) return;
        formulaCount = 0;

        const editors = document.querySelectorAll('[contenteditable="true"]');
        const mainContentDivs = document.querySelectorAll('div[aria-label="开始输入以编辑文本"]');

        if (mainContentDivs.length > 0) {
            mainContentDivs.forEach(mainDiv => {
                const text = getCleanTextContent(mainDiv);
                const formulas = findFormulas(text);
                formulaCount += formulas.length;
            });
        } else {
            for (const editor of editors) {
                if (!editor.closest('.notion-overlay-container')) {
                    const text = getCleanTextContent(editor);
                    const formulas = findFormulas(text);
                    formulaCount += formulas.length;
                }
            }
        }
        countElement.textContent = `检测到 ${formulaCount} 个公式`;
    }

    // 获取清理后的文本内容（处理跨节点问题）
    function getCleanTextContent(element) {
        // 克隆节点以避免修改原始DOM
        const clone = element.cloneNode(true);

        // 移除所有样式相关的属性，但保留文本
        const allElements = clone.querySelectorAll('*');
        allElements.forEach(el => {
            // 保留文本内容，移除属性
            if (el.tagName === 'BR') {
                el.replaceWith('\n');
            }
        });

        return clone.textContent || '';
    }

    // Start conversion process
    function startConversion() {
        if (isProcessing) return;
        isProcessing = true;
        shouldStopProcessing = false;
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

    function showProgressOverlay() {
        progressOverlay.classList.add('visible');
        updateProgress(0, 1);
    }

    function hideProgressOverlay() {
        progressOverlay.classList.remove('visible');
    }

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

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    // 改进的公式转换主函数
    async function convertFormulas() {
        updateStatus('扫描文档中...');
        const formulasToProcess = [];

        const editors = document.querySelectorAll('[contenteditable="true"]');
        const mainContentDivs = document.querySelectorAll('div[aria-label="开始输入以编辑文本"]');

        if (mainContentDivs.length > 0) {
            mainContentDivs.forEach(mainDiv => {
                const mainDivEditors = mainDiv.querySelectorAll('[contenteditable="true"]');
                mainDivEditors.forEach(editor => {
                    if (!editor.closest('.notion-overlay-container')) {
                        const text = getCleanTextContent(editor);
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
                    const text = getCleanTextContent(editor);
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
            const currentText = getCleanTextContent(editor);
            if (currentText && currentText.includes(formulaObject.fullMatch)) {
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

        for (let i = validFormulas.length - 1; i >= 0; i--) {
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

    // 改进的单个公式转换函数
    async function convertSingleFormula(editor, formulaObject) {
        const { fullMatch, content, type } = formulaObject;
        try {
            if (shouldStopProcessing) {
                return false;
            }

            // 使用改进的选择方法
            const selected = await selectFormulaText(editor, fullMatch);
            if (!selected) {
                console.warn("无法选择公式:", fullMatch.substring(0, 50) + '...');
                return false;
            }

            await sleep(400);

            if (shouldStopProcessing) return false;

            const area = await findOperationArea();
            if (!area) {
                console.warn("Operation area not found.");
                pressEscape();
                return false;
            }

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
            console.error("Error in convertSingleFormula:", error, "for formula:", fullMatch.substring(0, 50) + '...');
            pressEscape();
            return false;
        }
    }

    // 改进的文本选择函数（处理跨节点的情况）
    async function selectFormulaText(editor, formulaText) {
        try {
            // 方法1：尝试使用Range API直接选择
            const selection = window.getSelection();
            selection.removeAllRanges();

            // 尝试查找包含完整公式的最小容器
            const allElements = editor.querySelectorAll('div, span, p');
            for (const element of allElements) {
                const text = getCleanTextContent(element);
                if (text && text.includes(formulaText)) {
                    // 找到包含公式的元素，创建Range
                    const range = document.createRange();

                    // 尝试使用搜索算法找到确切位置
                    const result = findTextInElement(element, formulaText);
                    if (result) {
                        range.setStart(result.startNode, result.startOffset);
                        range.setEnd(result.endNode, result.endOffset);
                        selection.addRange(range);

                        // 触发焦点事件
                        element.focus({ preventScroll: true });
                        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                        return true;
                    }
                }
            }

            // 方法2：如果方法1失败，尝试全选然后查找替换
            console.log('使用备用选择方法...');
            editor.focus({ preventScroll: true });

            // 全选编辑器内容
            const range = document.createRange();
            range.selectNodeContents(editor);
            selection.addRange(range);

            // 使用浏览器的查找功能（如果支持）
            if (window.find) {
                selection.removeAllRanges();
                if (window.find(formulaText, false, false, false, false, false, false)) {
                    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('选择文本时出错:', error);
            return false;
        }
    }

    // 在元素中查找文本的辅助函数
    function findTextInElement(element, searchText) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        let aggregatedText = '';
        let nodes = [];
        let offsets = [];

        // 收集所有文本节点
        while (node = walker.nextNode()) {
            nodes.push(node);
            offsets.push(aggregatedText.length);
            aggregatedText += node.textContent;
        }

        // 在聚合文本中查找目标文本
        const startIndex = aggregatedText.indexOf(searchText);
        if (startIndex === -1) {
            return null;
        }

        const endIndex = startIndex + searchText.length;

        // 找到开始和结束节点
        let startNode = null, startOffset = 0;
        let endNode = null, endOffset = 0;

        for (let i = 0; i < nodes.length; i++) {
            const nodeStart = offsets[i];
            const nodeEnd = nodeStart + nodes[i].textContent.length;

            if (startNode === null && startIndex >= nodeStart && startIndex < nodeEnd) {
                startNode = nodes[i];
                startOffset = startIndex - nodeStart;
            }

            if (endIndex > nodeStart && endIndex <= nodeEnd) {
                endNode = nodes[i];
                endOffset = endIndex - nodeStart;
                break;
            }
        }

        if (startNode && endNode) {
            return {
                startNode: startNode,
                startOffset: startOffset,
                endNode: endNode,
                endOffset: endOffset
            };
        }

        return null;
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

        for (const selector of selectors) {
            const inputElement = area.querySelector(selector);
            if (inputElement && inputElement.offsetWidth > 0 && inputElement.offsetHeight > 0) {
                return inputElement;
            }
        }

        let fallbackInput = area.querySelector('div[contenteditable="true"]:not([style*="display: none"])');
        if (fallbackInput && fallbackInput.offsetWidth > 0 && fallbackInput.offsetHeight > 0) return fallbackInput;

        fallbackInput = area.querySelector('textarea:not([style*="display: none"])');
        if (fallbackInput && fallbackInput.offsetWidth > 0 && fallbackInput.offsetHeight > 0) return fallbackInput;

        return null;
    }

    // Simulate click
    async function simulateClick(element) {
        if (!element) return;
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
            if (shouldStopProcessing) return;
            element.dispatchEvent(event);
            await sleep(30);
        }
    }

    // Observe DOM changes with debounce
    let lastObserverRun = 0;
    const observerDebounceTime = 1000;

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

    console.log('Notion公式转换工具已加载 (v1.40 - 修复跨节点公式识别)');
})();