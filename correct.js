// ==UserScript==
// @name             Notion-Formula-Auto-Conversion-Tool-Fixed
// @namespace        http://tampermonkey.net/
// @version          1.99
// @description      自动公式转换工具 - 修复表格单元格公式选中问题
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

    // 【修复】定时器和观察器的引用，用于清理
    let updateInterval = null;
    let observer = null;
    let isUICreated = false;

    // 【修复】事件处理器引用，用于移除监听器
    const eventHandlers = {
        convert: null,
        stop: null,
        mousedown: null,
        mousemove: null,
        mouseup: null,
        mouseenter: null,
        mouseleave: null
    };

    // 【新增】清理函数 - 移除所有事件监听器、定时器和观察器
    function cleanup() {
        console.log('清理资源...');

        // 清除定时器
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }

        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        // 取消动画帧
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        // 断开观察器
        if (observer) {
            observer.disconnect();
            observer = null;
        }

        // 移除事件监听器
        if (convertBtn && eventHandlers.convert) {
            convertBtn.removeEventListener('click', eventHandlers.convert);
        }
        if (stopBtn && eventHandlers.stop) {
            stopBtn.removeEventListener('click', eventHandlers.stop);
        }
        if (eventHandlers.mousedown) {
            const ball = document.getElementById('formula-ball');
            if (ball) {
                ball.removeEventListener('mousedown', eventHandlers.mousedown);
            }
        }
        if (eventHandlers.mousemove) {
            document.removeEventListener('mousemove', eventHandlers.mousemove);
        }
        if (eventHandlers.mouseup) {
            document.removeEventListener('mouseup', eventHandlers.mouseup);
        }
        if (floatingBall) {
            if (eventHandlers.mouseenter) {
                floatingBall.removeEventListener('mouseenter', eventHandlers.mouseenter);
            }
            if (eventHandlers.mouseleave) {
                floatingBall.removeEventListener('mouseleave', eventHandlers.mouseleave);
            }
        }

        // 清除 DOM 引用
        floatingBall = null;
        convertBtn = null;
        progressOverlay = null;
        progressStatus = null;
        progressBar = null;
        stopBtn = null;

        isUICreated = false;
        console.log('资源清理完成');
    }

    // Create UI components
    function createUI() {
        // 【修复】防止重复创建
        if (isUICreated || document.getElementById('formula-floating-ball')) {
            console.log('UI 已存在，跳过创建');
            return;
        }

        console.log('创建 UI 组件');
        isUICreated = true;

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

        // 【修复】保存事件处理器引用
        convertBtn = document.getElementById('convert-btn');
        eventHandlers.convert = handleConvert;
        convertBtn.addEventListener('click', eventHandlers.convert);

        stopBtn = document.getElementById('stop-btn');
        eventHandlers.stop = stopConversion;
        stopBtn.addEventListener('click', eventHandlers.stop);

        progressStatus = document.getElementById('progress-status');
        progressBar = document.getElementById('progress-bar');

        const ball = document.getElementById('formula-ball');
        eventHandlers.mousedown = startDragging;
        eventHandlers.mousemove = onDragging;
        eventHandlers.mouseup = stopDragging;
        eventHandlers.mouseenter = expandBall;
        eventHandlers.mouseleave = collapseBall;

        ball.addEventListener('mousedown', eventHandlers.mousedown);
        document.addEventListener('mousemove', eventHandlers.mousemove);
        document.addEventListener('mouseup', eventHandlers.mouseup);
        floatingBall.addEventListener('mouseenter', eventHandlers.mouseenter);
        floatingBall.addEventListener('mouseleave', eventHandlers.mouseleave);

        updateFloatingBall();

        // 【优化】保存定时器引用，增加间隔减少性能开销（3秒→5秒）
        updateInterval = setInterval(updateFloatingBall, 5000);
    }

    // Animation frame handling
    function startAnimation() {
        if (animationFrameId !== null) return;

        function animate() {
            const deltaY = targetY - currentY;
            if (Math.abs(deltaY) < 0.5) {
                currentY = targetY;
                if (!isDragging) {
                    // 【修复】清除动画帧引用
                    animationFrameId = null;
                    return;
                }
            } else {
                currentY += deltaY * EASING_FACTOR;
            }

            // 【修复】检查元素是否还存在
            if (!floatingBall || !document.body.contains(floatingBall)) {
                animationFrameId = null;
                return;
            }

            floatingBall.style.top = `${currentY}px`;
            floatingBall.style.transform = 'none';

            animationFrameId = requestAnimationFrame(animate);
        }
        animationFrameId = requestAnimationFrame(animate);
    }

    // Dragging functions
    function startDragging(e) {
        if (!floatingBall) return;
        isDragging = true;
        dragOffsetY = e.clientY - floatingBall.getBoundingClientRect().top;
        floatingBall.style.transition = 'none';
        startAnimation();
    }

    function onDragging(e) {
        if (!isDragging || !floatingBall) return;
        e.preventDefault();
        const newY = e.clientY - dragOffsetY;
        const maxY = window.innerHeight - floatingBall.offsetHeight;
        targetY = Math.max(0, Math.min(newY, maxY));
    }

    function stopDragging() {
        if (!isDragging || !floatingBall) return;
        isDragging = false;
        floatingBall.style.transition = '';
    }

    // Ball expand/collapse with delay
    function expandBall() {
        if (!floatingBall) return;
        clearTimeout(hideTimeout);
        hideTimeout = null;
        floatingBall.classList.add('expanded');
    }

    function collapseBall() {
        if (!floatingBall) return;
        // 【修复】清除之前的超时引用
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }
        hideTimeout = setTimeout(() => {
            if (floatingBall) {
                floatingBall.classList.remove('expanded');
            }
            hideTimeout = null;
        }, 300);
    }

    // 【优化】防抖变量
    let lastUpdateTime = 0;
    const UPDATE_DEBOUNCE = 1000; // 1秒防抖

    // Update floating ball display
    function updateFloatingBall() {
        if (isProcessing) return;

        // 【优化】防抖：避免频繁更新
        const now = Date.now();
        if (now - lastUpdateTime < UPDATE_DEBOUNCE) {
            return;
        }
        lastUpdateTime = now;

        // 【优化】快速检查：如果页面没有$符号，直接跳过
        const pageText = document.body.textContent || '';
        if (!pageText.includes('$')) {
            const countElement = document.getElementById('formula-count');
            if (countElement) {
                countElement.textContent = '无公式';
                if (convertBtn) convertBtn.disabled = true;
            }
            return;
        }

        const formulas = getAllFormulas();
        formulaCount = formulas.length;
        const countElement = document.getElementById('formula-count');

        if (countElement) {
            if (formulaCount > 0) {
                const blockCount = formulas.filter(f => f.type === 'block').length;
                const inlineCount = formulas.filter(f => f.type === 'inline').length;

                if (blockCount > 0 && inlineCount > 0) {
                    countElement.textContent = `${inlineCount}内联+${blockCount}块级`;
                } else if (blockCount > 0) {
                    countElement.textContent = `${blockCount} 个块级公式`;
                } else {
                    countElement.textContent = `${inlineCount} 个公式`;
                }
                if (convertBtn) convertBtn.disabled = false;
            } else {
                countElement.textContent = '无公式';
                if (convertBtn) convertBtn.disabled = true;
            }
        }
    }

    // Sleep function
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 计算元素在DOM中的位置（用于排序）
    function getDOMPosition(element) {
        if (!element) return Infinity;

        // 获取元素相对于文档的位置
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        // 使用 top 和 left 的组合作为位置标识
        // 乘以10000是为了确保top的优先级高于left
        return (rect.top + scrollTop) * 10000 + (rect.left + scrollLeft);
    }

    // 获取所有公式（支持跨节点和表格）
    function getAllFormulas() {
        const formulas = [];
        const processedTexts = new Set();

        const contentSelectors = [
            '.notion-page-content',
            '.notion-scroller',
            '[data-content-editable-root="true"]',
            '.notion-frame',
            '.notion-table-view',
            '.notion-collection-view-body',
            '.notion-selectable',
            'div[contenteditable="true"]'
        ];

        const containers = [];
        for (const selector of contentSelectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (!containers.some(c => c.contains(el) || el.contains(c))) {
                    containers.push(el);
                }
            });
        }

        if (containers.length === 0) {
            containers.push(document.body);
        }

        console.log(`在 ${containers.length} 个容器中搜索公式`);

        for (const container of containers) {
            const tableCells = container.querySelectorAll('.notion-table-cell-text, td[contenteditable="true"], div[role="textbox"]');
            for (const cell of tableCells) {
                const cellText = cell.textContent || '';
                if (cellText.includes('$')) {
                    const cellFormulas = extractFormulasFromText(cellText);
                    for (const formula of cellFormulas) {
                        const uniqueKey = formula.content + '|' + cell.textContent?.substring(0, 50);
                        if (!processedTexts.has(uniqueKey)) {
                            processedTexts.add(uniqueKey);
                            // 【修复】不直接存储 element 引用，而是使用 WeakRef（如果支持）
                            formulas.push({
                                type: formula.type,
                                content: formula.content,
                                fullMatch: formula.fullMatch,
                                element: cell,  // 保留引用，但会在函数结束后释放
                                isTableCell: true,
                                domPosition: getDOMPosition(cell)
                            });
                        }
                    }
                }
            }

            const walker = document.createTreeWalker(
                container,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function(node) {
                        const parent = node.parentElement;
                        if (!parent) return NodeFilter.FILTER_REJECT;

                        const tagName = parent.tagName?.toLowerCase();
                        if (['script', 'style', 'noscript', 'iframe', 'object', 'embed'].includes(tagName)) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        if (parent.closest('.notion-formula-editor') ||
                            parent.closest('.notion-overlay-container') ||
                            parent.closest('#formula-floating-ball') ||
                            parent.closest('#progress-overlay')) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        if (parent.closest('.notion-table-cell-text')) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            );

            let currentFormula = '';
            let formulaNodes = [];
            let node;

            while (node = walker.nextNode()) {
                const text = node.textContent;

                if (text.includes('$')) {
                    currentFormula += text;
                    formulaNodes.push(node);

                    const nextNode = walker.nextNode();
                    if (nextNode) {
                        const nextText = nextNode.textContent;
                        if (!nextText.startsWith(' ') && !nextText.startsWith('\n')) {
                            walker.previousNode();
                            continue;
                        }
                        walker.previousNode();
                    }

                    const extractedFormulas = extractFormulasFromText(currentFormula);
                    for (const formula of extractedFormulas) {
                        // 【修复】使用叶子节点textContent作为uniqueKey，避免parentElement的不稳定性
                        const leafNode = formulaNodes[0]?.parentElement?.closest('[data-content-editable-leaf="true"]');
                        const uniqueKey = formula.content + '|' + (leafNode?.textContent || '').substring(0, 50);
                        if (!processedTexts.has(uniqueKey)) {
                            processedTexts.add(uniqueKey);
                            // 【关键修复】不保存nodes引用（从未被使用，且导致严重内存泄漏）
                            formulas.push({
                                type: formula.type,
                                content: formula.content,
                                fullMatch: formula.fullMatch,
                                isTableCell: false,
                                domPosition: getDOMPosition(leafNode)
                            });
                        }
                    }

                    currentFormula = '';
                    formulaNodes = [];
                } else if (currentFormula) {
                    currentFormula += text;
                    formulaNodes.push(node);

                    if (text.includes('\n') || text.includes('。') || text.includes('.') || text.includes('，')) {
                        const extractedFormulas = extractFormulasFromText(currentFormula);
                        for (const formula of extractedFormulas) {
                            const leafNode = formulaNodes[0]?.parentElement?.closest('[data-content-editable-leaf="true"]');
                            const uniqueKey = formula.content + '|' + (leafNode?.textContent || '').substring(0, 50);
                            if (!processedTexts.has(uniqueKey)) {
                                processedTexts.add(uniqueKey);
                                formulas.push({
                                    type: formula.type,
                                    content: formula.content,
                                    fullMatch: formula.fullMatch,
                                    isTableCell: false,
                                    domPosition: getDOMPosition(leafNode)
                                });
                            }
                        }
                        currentFormula = '';
                        formulaNodes = [];
                    }
                }
            }

            if (currentFormula) {
                const extractedFormulas = extractFormulasFromText(currentFormula);
                for (const formula of extractedFormulas) {
                    const leafNode = formulaNodes[0]?.parentElement?.closest('[data-content-editable-leaf="true"]');
                    const uniqueKey = formula.content + '|' + (leafNode?.textContent || '').substring(0, 50);
                    if (!processedTexts.has(uniqueKey)) {
                        processedTexts.add(uniqueKey);
                        formulas.push({
                            type: formula.type,
                            content: formula.content,
                            fullMatch: formula.fullMatch,
                            isTableCell: false,
                            domPosition: getDOMPosition(leafNode)
                        });
                    }
                }
            }
        }

        // 按照DOM位置排序（从上到下，从左到右）
        formulas.sort((a, b) => {
            const posA = a.domPosition || Infinity;
            const posB = b.domPosition || Infinity;
            return posA - posB;
        });

        console.log(`找到 ${formulas.length} 个公式（包括 ${formulas.filter(f => f.isTableCell).length} 个表格公式），已按DOM顺序排序`);

        // 【修复】清空 processedTexts Set 以释放内存
        processedTexts.clear();

        return formulas;
    }

    // 从文本中提取公式 - 处理连续公式（无空格分隔）
    function extractFormulasFromText(text) {
        const formulas = [];
        let pos = 0;

        while (pos < text.length) {
            // 查找下一个 $ 符号
            const dollarPos = text.indexOf('$', pos);
            if (dollarPos === -1) break;

            // 检查是否是 $$（块级公式）
            const isBlock = text[dollarPos + 1] === '$';
            const startDelimiter = isBlock ? '$$' : '$';
            const startPos = dollarPos;
            const contentStart = dollarPos + startDelimiter.length;

            // 查找结束符
            let endPos = contentStart;
            let escapeCount = 0;
            let found = false;

            while (endPos < text.length) {
                const char = text[endPos];

                if (char === '\\') {
                    escapeCount++;
                    endPos++;
                    continue;
                }

                // 检查是否是结束符
                if (isBlock) {
                    // 块级公式：查找 $$
                    if (text.substring(endPos, endPos + 2) === '$$') {
                        if (escapeCount % 2 === 0) {
                            // 找到未转义的结束符
                            const content = text.substring(contentStart, endPos).trim();
                            if (content && content.length > 0) {
                                formulas.push({
                                    type: 'block',
                                    content: content,
                                    fullMatch: text.substring(startPos, endPos + 2),
                                    startIndex: startPos,
                                    endIndex: endPos + 2
                                });
                            }
                            pos = endPos + 2;
                            found = true;
                            break;
                        }
                    }
                } else {
                    // 内联公式：查找单个 $
                    if (char === '$') {
                        if (escapeCount % 2 === 0) {
                            // 找到未转义的 $ 就是结束符
                            // 即使后面紧跟着 $ 也没关系，那是下一个公式的事
                            const content = text.substring(contentStart, endPos).trim();
                            if (content && content.length > 0) {
                                // 对于包含aligned等多行环境的公式，允许更多换行
                                const hasMultilineEnv = /\\begin\{(aligned|align|gather|split|array|matrix)\}/.test(content);
                                const maxNewlines = hasMultilineEnv ? 10 : 2;
                                const newlineCount = (content.match(/\n/g) || []).length;

                                if (newlineCount <= maxNewlines) {
                                    formulas.push({
                                        type: 'inline',
                                        content: content,
                                        fullMatch: text.substring(startPos, endPos + 1),
                                        startIndex: startPos,
                                        endIndex: endPos + 1
                                    });
                                }
                            }
                            pos = endPos + 1;
                            found = true;
                            break;
                        }
                    }
                }

                escapeCount = 0;
                endPos++;
            }

            // 如果没有找到结束符，跳过这个起始符
            if (!found) {
                pos = startPos + 1;
            }
        }

        return formulas;
    }

    // Handle conversion - 每次只转换一个公式
    async function handleConvert() {
        if (isProcessing || formulaCount === 0) return;

        isProcessing = true;
        shouldStopProcessing = false;
        if (convertBtn) convertBtn.classList.add('processing');
        if (progressOverlay) progressOverlay.classList.add('visible');
        if (floatingBall) floatingBall.classList.add('active');

        let converted = 0;
        let failed = 0;
        let iteration = 0;
        const maxIterations = 100; // 防止无限循环

        console.log('=== 开始逐个转换公式 ===');

        while (iteration < maxIterations) {
            if (shouldStopProcessing) {
                if (progressStatus) progressStatus.textContent = `转换已停止 (${converted}/${converted + failed})`;
                break;
            }

            // 每次都重新扫描，获取当前第一个公式
            const formulas = getAllFormulas();

            if (formulas.length === 0) {
                console.log('没有更多公式，转换完成');
                break;
            }

            const formula = formulas[0]; // 每次只处理第一个
            const formulaTypeText = formula.type === 'block' ? '块级' : '内联';
            const isLongFormula = formula.content.length > 200;
            const tableText = formula.isTableCell ? '表格' : '';

            console.log(`\n[第 ${iteration + 1} 次] 处理${tableText}${formulaTypeText}公式:`);
            console.log(`  剩余公式数: ${formulas.length}`);
            console.log(`  内容预览: ${formula.content.substring(0, 50)}...`);

            if (progressStatus) {
                progressStatus.textContent = `转换${tableText}${formulaTypeText} (已完成:${converted}, 剩余:${formulas.length})`;
            }
            if (progressBar) {
                progressBar.style.width = `${(iteration / (iteration + formulas.length)) * 100}%`;
            }

            try {
                const result = await convertFormula(formula);
                if (result) {
                    converted++;
                    console.log(`  ✓ 转换成功`);
                } else {
                    failed++;
                    console.warn(`  ✗ 转换失败`);
                }
            } catch (error) {
                failed++;
                console.error(`  ✗ 转换出错:`, error);
            }

            const waitTime = isLongFormula ? 500 : 300;
            await sleep(waitTime);

            iteration++;
        }

        if (iteration >= maxIterations) {
            console.warn('达到最大迭代次数，停止转换');
        }

        console.log('\n=== 转换完成 ===');
        console.log(`成功: ${converted}, 失败: ${failed}`);

        await sleep(1000);
        const remainingFormulas = getAllFormulas();
        const remainingCount = remainingFormulas.length;

        let message = shouldStopProcessing
            ? `已停止 (成功: ${converted}, 失败: ${failed})`
            : `完成 (成功: ${converted}, 失败: ${failed})`;

        if (remainingCount > 0) {
            message += ` - 还有 ${remainingCount} 个公式`;
            console.log(`\n⚠ 转换完成，但仍检测到 ${remainingCount} 个公式`);
        }

        if (progressStatus) progressStatus.textContent = message;

        setTimeout(() => {
            if (progressOverlay) progressOverlay.classList.remove('visible');
            if (floatingBall) floatingBall.classList.remove('active');
            if (convertBtn) convertBtn.classList.remove('processing');
            isProcessing = false;
            updateFloatingBall();

            if (remainingCount > 0 && floatingBall && convertBtn) {
                floatingBall.classList.add('expanded');
                convertBtn.style.background = '#ffd700';
                convertBtn.textContent = '继续转换';

                setTimeout(() => {
                    if (convertBtn) {
                        convertBtn.style.background = '';
                        convertBtn.textContent = '转换';
                    }
                }, 3000);
            }
        }, 2000);
    }

    // Stop conversion
    function stopConversion() {
        shouldStopProcessing = true;
        if (progressStatus) progressStatus.textContent = '正在停止...';
    }

    // Convert single formula
    async function convertFormula(formula) {
        if (shouldStopProcessing) return false;

        const formulaLength = formula.content.length;
        const isLongFormula = formulaLength > 200;
        const isTableCell = formula.isTableCell || false;

        console.log(`开始转换${isTableCell ? '表格中的' : ''}${formula.type === 'block' ? '块级' : '内联'}公式 (${formulaLength} 字符): "${formula.content.substring(0, 50)}${formulaLength > 50 ? '...' : ''}"`);

        try {
            // 【新增】自动滚动到公式位置
            const targetElement = isTableCell && formula.element
                ? formula.element
                : document.querySelector('[data-content-editable-leaf="true"]');

            if (targetElement) {
                // 查找包含公式的叶子节点
                const leafElements = document.querySelectorAll('[data-content-editable-leaf="true"]');
                for (const leaf of leafElements) {
                    if (leaf.textContent && leaf.textContent.includes(formula.fullMatch)) {
                        console.log('滚动到公式位置');
                        leaf.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await sleep(300); // 等待滚动完成
                        break;
                    }
                }
            }

            if (isTableCell && formula.element) {
                console.log('使用表格单元格特殊处理流程');

                const cell = formula.element;
                await simulateClick(cell);
                await sleep(200);

                // 【修复】优先尝试精确选中公式部分，而不是整个单元格
                const selected = await selectFormulaTextInCell(cell, formula.fullMatch);
                if (!selected) {
                    console.warn('无法精确选中公式，尝试备用方法（选中整个单元格）');
                    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                    const metaKey = isMac ? 'metaKey' : 'ctrlKey';

                    cell.focus();
                    await sleep(100);

                    const selectAllEvent = new KeyboardEvent('keydown', {
                        key: 'a',
                        code: 'KeyA',
                        keyCode: 65,
                        [metaKey]: true,
                        bubbles: true,
                        cancelable: true
                    });

                    cell.dispatchEvent(selectAllEvent);
                    await sleep(100);

                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    const range = document.createRange();
                    range.selectNodeContents(cell);
                    selection.addRange(range);

                    await sleep(100);
                }
            } else {
                const selected = await selectFormulaText(formula.fullMatch, false);
                if (!selected) {
                    console.warn('无法选中公式文本，尝试备用方法');
                    if (isLongFormula) {
                        await sleep(200);
                        const retrySelected = await selectFormulaText(formula.fullMatch, false);
                        if (!retrySelected) {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
            }

            await sleep(isTableCell ? 300 : (isLongFormula ? 200 : 100));

            const clicked = await clickFormula(formula.type);
            if (!clicked) {
                console.warn('未找到Formula按钮，尝试备用方案');
                if (isTableCell) {
                    const cell = formula.element;
                    const rightClickEvent = new MouseEvent('contextmenu', {
                        bubbles: true,
                        cancelable: true,
                        clientX: cell.getBoundingClientRect().left + 10,
                        clientY: cell.getBoundingClientRect().top + 10
                    });
                    cell.dispatchEvent(rightClickEvent);
                    await sleep(200);

                    const retryClicked = await clickFormula(formula.type);
                    if (!retryClicked) {
                        pressEscape();
                        return false;
                    }
                } else {
                    pressEscape();
                    return false;
                }
            }

            await sleep(isLongFormula ? 300 : 200);
            const area = await findOperationArea();
            if (!area) {
                console.error('找不到操作区域');
                pressEscape();
                return false;
            }

            const inputElement = await findEditorInput(area);
            if (!inputElement) {
                console.error('找不到输入框');
                pressEscape();
                return false;
            }

            inputElement.focus();
            await simulateTyping(inputElement);
            await sleep(isLongFormula ? 200 : 100);

            // 【修复】清空输入框 - 只使用一种方式
            if (inputElement.tagName === 'TEXTAREA') {
                inputElement.value = '';
            } else {
                inputElement.textContent = '';
            }

            await sleep(50);

            // 【修复】直接设置内容，避免复杂的事件模拟导致文本篡改
            if (inputElement.tagName === 'TEXTAREA') {
                inputElement.value = formula.content;
            } else {
                inputElement.textContent = formula.content;
            }

            // 【关键修复】使用简单的Event，避免InputEvent的data参数导致文本被篡改
            const inputEvent = new Event('input', { bubbles: true });
            inputElement.dispatchEvent(inputEvent);
            await sleep(100);

            const changeEvent = new Event('change', { bubbles: true });
            inputElement.dispatchEvent(changeEvent);

            // 【优化】给Notion更多时间处理输入和渲染预览
            await sleep(isLongFormula ? 500 : 200);

            const doneButton = await findButton(area, {
                buttonText: ['Done', '完成', 'Confirm', '确认', 'OK'],
                attempts: isLongFormula ? 60 : 40,
                delay: isLongFormula ? 200 : 150,
                shouldStop: () => shouldStopProcessing
            });

            if (doneButton) {
                console.log(`找到完成按钮，准备点击`);
                await simulateClick(doneButton);
                // 【优化】点击后等待更长时间，确保Notion完成转换
                await sleep(isTableCell ? 700 : (isLongFormula ? 600 : 300));
                console.log(`${isTableCell ? '表格' : ''}${formula.type === 'block' ? '块级' : '内联'}公式转换成功 (${formulaLength} 字符)`);
                return true;
            }

            console.log('未找到Done按钮，尝试按Enter键');
            inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            await sleep(50);
            inputElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true }));
            await sleep(200);

            const stillOpen = await findOperationArea();
            if (!stillOpen) {
                console.log('通过Enter键成功提交公式');
                return true;
            }

            pressEscape();
            return false;

        } catch (error) {
            console.error('转换公式时出错:', error);
            pressEscape();
            return false;
        }
    }

    // Click Formula button
    async function clickFormula(formulaType = 'inline') {
        if (shouldStopProcessing) return false;

        await sleep(100);

        console.log('尝试使用斜杠命令触发公式转换');

        const selection = window.getSelection();
        if (selection.toString().length > 0) {
            const activeElement = document.activeElement;
            if (activeElement) {
                const slashEvent = new KeyboardEvent('keypress', {
                    key: '/',
                    code: 'Slash',
                    keyCode: 47,
                    charCode: 47,
                    bubbles: true,
                    cancelable: true
                });
                activeElement.dispatchEvent(slashEvent);
                await sleep(200);

                const commandMenu = document.querySelector('.notion-overlay-container, [role="menu"], .notion-slash-menu');
                if (commandMenu) {
                    console.log('找到斜杠命令菜单');

                    const commands = ['equation', 'formula', '公式'];
                    for (const cmd of commands) {
                        for (const char of cmd) {
                            const charEvent = new KeyboardEvent('keypress', {
                                key: char,
                                bubbles: true,
                                cancelable: true
                            });
                            activeElement.dispatchEvent(charEvent);
                            await sleep(20);
                        }

                        await sleep(200);

                        const options = commandMenu.querySelectorAll('[role="option"], [role="menuitem"], .notion-slash-menu-item');
                        for (const option of options) {
                            const text = option.textContent?.toLowerCase() || '';
                            if (text.includes('equation') || text.includes('formula') || text.includes('公式')) {
                                console.log('找到公式选项，点击');
                                await simulateClick(option);
                                await sleep(300);

                                const formulaEditor = await findOperationArea();
                                if (formulaEditor) {
                                    console.log('成功通过斜杠命令打开公式编辑器');
                                    return true;
                                }
                            }
                        }

                        for (let i = 0; i < cmd.length; i++) {
                            const backspaceEvent = new KeyboardEvent('keydown', {
                                key: 'Backspace',
                                bubbles: true,
                                cancelable: true
                            });
                            activeElement.dispatchEvent(backspaceEvent);
                            await sleep(20);
                        }
                    }

                    pressEscape();
                    await sleep(100);
                }
            }
        }

        const blockTexts = ['block equation', 'block', '块级公式', '公式块'];
        const inlineTexts = ['inline equation', 'inline', '内联公式', 'formula'];
        const genericTexts = ['formula', 'equation', '公式'];

        const buttonSelectors = [
            ...(formulaType === 'block' ?
                blockTexts.map(text => `div[role="button"]:has-text("${text}")`) :
                inlineTexts.map(text => `div[role="button"]:has-text("${text}")`)),

            ...genericTexts.map(text => `div[role="button"]:has-text("${text}")`),

            'div[role="button"]:has(svg.equation)',
            'div[role="button"]:has(svg.squareRootSmall)',
            'div[role="button"]:has(svg[class*="square"])',
            'div[role="button"]:has(svg[class*="root"])',
            'div[role="button"]:has(svg[class*="equation"])',
            'div[role="button"]:has(svg[class*="formula"])',

            'div[role="button"]:has(svg path[d*="M15.425"])',
            'div[role="button"]:has(svg path[d*="M14.5"])',

            '.notion-overlay-container div[role="button"]:has(svg)'
        ];

        for (const selector of buttonSelectors) {
            try {
                const buttons = document.querySelectorAll(selector);
                for (const button of buttons) {
                    if (button.offsetWidth > 0 && button.offsetHeight > 0) {
                        const text = button.textContent.toLowerCase();
                        const svg = button.querySelector('svg');

                        if (formulaType === 'block' && text && text.includes('block')) {
                            await simulateClick(button);
                            console.log('点击了Block Equation按钮');
                            return true;
                        }

                        if (formulaType === 'inline' && text && text.includes('inline')) {
                            await simulateClick(button);
                            console.log('点击了Inline Equation按钮');
                            return true;
                        }

                        if (text && (text.includes('formula') || text.includes('equation') || text.includes('公式'))) {
                            await simulateClick(button);
                            console.log(`点击了Formula文本按钮 (${formulaType})`);
                            return true;
                        }

                        if (svg) {
                            const svgClass = svg.getAttribute('class') || '';
                            const svgViewBox = svg.getAttribute('viewBox') || '';

                            if (svgClass.includes('square') ||
                                svgClass.includes('root') ||
                                svgClass.includes('equation') ||
                                svgClass.includes('formula') ||
                                svgViewBox === '0 0 16 16') {

                                const paths = svg.querySelectorAll('path');
                                for (const path of paths) {
                                    const d = path.getAttribute('d') || '';
                                    if (d.includes('15.425') || d.includes('14.5') || d.includes('3.4')) {
                                        await simulateClick(button);
                                        console.log(`点击了Formula SVG按钮 (${formulaType})`);
                                        return true;
                                    }
                                }

                                if (svgClass.includes('squareRootSmall')) {
                                    await simulateClick(button);
                                    console.log(`点击了squareRootSmall SVG按钮 (${formulaType})`);
                                    return true;
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                continue;
            }
        }

        const allButtons = document.querySelectorAll('[role="button"]');
        console.log(`检查 ${allButtons.length} 个按钮`);

        for (const button of allButtons) {
            if (button.offsetWidth > 0 && button.offsetHeight > 0) {
                const svg = button.querySelector('svg');
                if (svg) {
                    const overlay = button.closest('.notion-overlay-container');
                    if (overlay && overlay.style.display !== 'none') {
                        const svgClass = svg.getAttribute('class') || '';

                        if (svgClass.includes('squareRootSmall') ||
                            svgClass.includes('square') ||
                            svgClass.includes('root')) {
                            await simulateClick(button);
                            console.log(`通过后备方案找到并点击了Formula按钮 (${formulaType})`);
                            return true;
                        }
                    }
                }
            }
        }

        console.error(`未找到${formulaType === 'block' ? '块级' : '内联'}Formula按钮`);
        return false;
    }

    // 【新增】在表格单元格内精确选中公式文本
    async function selectFormulaTextInCell(cell, formulaText) {
        if (!cell || !formulaText) return false;

        try {
            const cellText = cell.textContent || '';
            const startIndex = cellText.indexOf(formulaText);

            if (startIndex === -1) {
                console.warn('单元格中找不到公式文本');
                return false;
            }

            const endIndex = startIndex + formulaText.length;
            console.log(`在单元格中找到公式，位置: ${startIndex} - ${endIndex}`);

            cell.focus();
            await sleep(100);

            const selection = window.getSelection();
            selection.removeAllRanges();

            // 使用TreeWalker遍历文本节点，精确定位公式
            const walker = document.createTreeWalker(
                cell,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            let currentPos = 0;
            let startNode = null, startOffset = 0;
            let endNode = null, endOffset = 0;
            let node;

            while (node = walker.nextNode()) {
                const nodeLength = node.textContent.length;
                const nodeEnd = currentPos + nodeLength;

                // 找到开始节点
                if (startNode === null && startIndex >= currentPos && startIndex < nodeEnd) {
                    startNode = node;
                    startOffset = startIndex - currentPos;
                }

                // 找到结束节点
                if (endIndex > currentPos && endIndex <= nodeEnd) {
                    endNode = node;
                    endOffset = endIndex - currentPos;
                    break;
                }

                currentPos = nodeEnd;
            }

            if (startNode && endNode) {
                const range = document.createRange();
                range.setStart(startNode, startOffset);
                range.setEnd(endNode, endOffset);
                selection.addRange(range);

                document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                await sleep(100);

                console.log('成功在单元格中精确选中公式');
                return true;
            }

            console.warn('无法定位公式的精确范围');
            return false;
        } catch (error) {
            console.error('在单元格中选中公式时出错:', error);
            return false;
        }
    }

    // Select formula text - 在叶子节点内精确选中公式范围
    async function selectFormulaText(formulaText, isTableCell = false) {
        if (!formulaText || shouldStopProcessing) return false;

        try {
            console.log(`尝试选中公式: ${formulaText.substring(0, 50)}...`);

            // 查找包含这个公式的叶子节点
            const leafElements = document.querySelectorAll('[data-content-editable-leaf="true"]');

            for (const leaf of leafElements) {
                const leafText = leaf.textContent || '';

                // 检查是否包含公式的fullMatch
                if (leafText.includes(formulaText)) {
                    console.log('找到包含公式的叶子节点');

                    // 在叶子节点内查找公式的位置
                    const startIndex = leafText.indexOf(formulaText);
                    if (startIndex === -1) continue;

                    const endIndex = startIndex + formulaText.length;

                    console.log(`公式在叶子节点中的位置: ${startIndex} - ${endIndex}`);

                    leaf.focus();
                    await sleep(100);

                    // 尝试在叶子节点内创建精确的Range
                    const selection = window.getSelection();
                    selection.removeAllRanges();

                    // 使用TreeWalker遍历文本节点
                    const walker = document.createTreeWalker(
                        leaf,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                    );

                    let currentPos = 0;
                    let startNode = null, startOffset = 0;
                    let endNode = null, endOffset = 0;
                    let node;

                    while (node = walker.nextNode()) {
                        const nodeLength = node.textContent.length;
                        const nodeEnd = currentPos + nodeLength;

                        // 找到开始节点
                        if (startNode === null && startIndex >= currentPos && startIndex < nodeEnd) {
                            startNode = node;
                            startOffset = startIndex - currentPos;
                        }

                        // 找到结束节点
                        if (endIndex > currentPos && endIndex <= nodeEnd) {
                            endNode = node;
                            endOffset = endIndex - currentPos;
                            break;
                        }

                        currentPos = nodeEnd;
                    }

                    if (startNode && endNode) {
                        const range = document.createRange();
                        range.setStart(startNode, startOffset);
                        range.setEnd(endNode, endOffset);
                        selection.addRange(range);

                        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                        await sleep(100);

                        console.log('成功精确选中公式范围');
                        return true;
                    } else {
                        console.warn('无法定位公式的精确范围，尝试选中整个节点');

                        // 后备方案：选中整个节点
                        const range = document.createRange();
                        range.selectNodeContents(leaf);
                        selection.addRange(range);

                        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                        await sleep(100);

                        console.log('已选中整个叶子节点（后备方案）');
                        return true;
                    }
                }
            }

            // 如果没找到，使用表格单元格查找
            if (isTableCell) {
                const cells = document.querySelectorAll('.notion-table-cell-text, td[contenteditable="true"], div[role="textbox"]');
                for (const cell of cells) {
                    const cellText = cell.textContent || '';

                    if (cellText.includes(formulaText)) {
                        // 【修复】优先尝试精确选中公式，而不是选中整个单元格
                        const selected = await selectFormulaTextInCell(cell, formulaText);
                        if (selected) {
                            return true;
                        }

                        // 后备方案：选中整个单元格（可能导致问题，但作为最后手段）
                        console.warn('精确选中失败，尝试选中整个单元格');
                        cell.focus();
                        await sleep(100);

                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        const range = document.createRange();
                        range.selectNodeContents(cell);
                        selection.addRange(range);

                        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                        await sleep(100);
                        return true;
                    }
                }
            }

            console.warn('无法找到包含公式的节点');
            return false;
        } catch (error) {
            console.error('选择文本时出错:', error);
            return false;
        }
    }

    function pressEscape() {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        setTimeout(() => {
            document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true, cancelable: true }));
        }, 50);
    }

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
                // 【优化】优先查找特征更明显的按钮（有蓝色背景的完成按钮）
                if (buttonText.length > 0) {
                    const text = btn.textContent.toLowerCase().trim();
                    const hasMatchingText = buttonText.some(t => text.includes(t.toLowerCase()));

                    if (hasMatchingText) {
                        // 检查是否是带有arrowTurnDownLeftSmall图标的完成按钮
                        const svg = btn.querySelector('svg.arrowTurnDownLeftSmall, svg.directional-icon');
                        if (svg) {
                            console.log('找到带图标的完成按钮');
                            return true;
                        }
                        // 或者检查是否有蓝色背景样式
                        const bgColor = window.getComputedStyle(btn).backgroundColor;
                        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                            console.log('找到有背景色的完成按钮');
                            return true;
                        }
                        // 普通文本匹配
                        return true;
                    }
                }

                if (hasSvg) {
                    const svg = btn.querySelector(`svg.${svgClass}`);
                    if (svg) return true;

                    const anySvg = btn.querySelector('svg');
                    if (anySvg) {
                        const className = anySvg.getAttribute('class') || '';
                        if (className.includes('square') ||
                            className.includes('root') ||
                            className.includes(svgClass)) {
                            return true;
                        }
                    }
                }

                return false;
            });
            if (button) return button;
            await sleep(delay);
        }
        return null;
    }

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

    let lastObserverRun = 0;
    const observerDebounceTime = 3000;  // 【优化】增加防抖时间（1秒→3秒）

    // 【修复】使用防抖和检查避免重复创建
    const debouncedCreateUI = () => {
        const now = Date.now();
        if (now - lastObserverRun > observerDebounceTime) {
            lastObserverRun = now;
            if (!document.getElementById('formula-floating-ball') && !isUICreated) {
                createUI();
            }
        }
    };

    // 【修复】初始化观察器
    function initObserver() {
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver(debouncedCreateUI);

        const target = document.querySelector('.notion-app-inner') || document.body;
        observer.observe(target, { childList: true, subtree: true });
    }

    // 【新增】页面卸载时清理资源
    window.addEventListener('beforeunload', cleanup);

    // 【修复】初始化脚本
    setTimeout(() => {
        createUI();
        initObserver();
    }, 1000);

    console.log('Notion公式转换工具已加载 (v1.99 - 修复表格单元格公式选中问题)');
})();