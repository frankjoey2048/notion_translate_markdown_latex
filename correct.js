// ==UserScript==
// @name             Notion-Formula-Auto-Conversion-Tool-Fixed
// @namespace        http://tampermonkey.net/
// @version          1.70
// @description      自动公式转换工具 - 支持复杂长公式，改进$...$内联和$$...$$块级公式识别
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
        convertBtn.addEventListener('click', handleConvert);

        stopBtn = document.getElementById('stop-btn');
        stopBtn.addEventListener('click', stopConversion);

        progressStatus = document.getElementById('progress-status');
        progressBar = document.getElementById('progress-bar');

        const ball = document.getElementById('formula-ball');
        ball.addEventListener('mousedown', startDragging);
        document.addEventListener('mousemove', onDragging);
        document.addEventListener('mouseup', stopDragging);
        floatingBall.addEventListener('mouseenter', expandBall);
        floatingBall.addEventListener('mouseleave', collapseBall);

        updateFloatingBall();
        setInterval(updateFloatingBall, 3000);
    }

    // Animation frame handling
    function startAnimation() {
        if (animationFrameId !== null) return;

        function animate() {
            const deltaY = targetY - currentY;
            if (Math.abs(deltaY) < 0.5) {
                currentY = targetY;
                if (!isDragging) {
                    animationFrameId = null;
                    return;
                }
            } else {
                currentY += deltaY * EASING_FACTOR;
            }

            floatingBall.style.top = `${currentY}px`;
            floatingBall.style.transform = 'none';

            animationFrameId = requestAnimationFrame(animate);
        }
        animationFrameId = requestAnimationFrame(animate);
    }

    // Dragging functions
    function startDragging(e) {
        isDragging = true;
        dragOffsetY = e.clientY - floatingBall.getBoundingClientRect().top;
        floatingBall.style.transition = 'none';
        startAnimation();
    }

    function onDragging(e) {
        if (!isDragging) return;
        e.preventDefault();
        const newY = e.clientY - dragOffsetY;
        const maxY = window.innerHeight - floatingBall.offsetHeight;
        targetY = Math.max(0, Math.min(newY, maxY));
    }

    function stopDragging() {
        if (!isDragging) return;
        isDragging = false;
        floatingBall.style.transition = '';
    }

    // Ball expand/collapse with delay
    function expandBall() {
        clearTimeout(hideTimeout);
        floatingBall.classList.add('expanded');
    }

    function collapseBall() {
        hideTimeout = setTimeout(() => {
            floatingBall.classList.remove('expanded');
        }, 300);
    }

    // Update floating ball display
    function updateFloatingBall() {
        if (isProcessing) return;

        const formulas = getAllFormulas();
        formulaCount = formulas.length;
        const countElement = document.getElementById('formula-count');

        if (countElement) {
            if (formulaCount > 0) {
                // 统计块级和内联公式数量
                const blockCount = formulas.filter(f => f.type === 'block').length;
                const inlineCount = formulas.filter(f => f.type === 'inline').length;
                
                if (blockCount > 0 && inlineCount > 0) {
                    countElement.textContent = `${inlineCount}内联+${blockCount}块级`;
                } else if (blockCount > 0) {
                    countElement.textContent = `${blockCount} 个块级公式`;
                } else {
                    countElement.textContent = `${inlineCount} 个公式`;
                }
                convertBtn.disabled = false;
            } else {
                countElement.textContent = '无公式';
                convertBtn.disabled = true;
            }
        }
    }

    // Sleep function
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 获取所有公式（支持跨节点）
    function getAllFormulas() {
        const formulas = [];
        const processedTexts = new Set();

        // 获取页面上可能包含公式的元素
        const contentSelectors = [
            '.notion-page-content',
            '.notion-scroller',
            '[data-content-editable-root="true"]',
            '.notion-frame'
        ];

        let contentArea = null;
        for (const selector of contentSelectors) {
            contentArea = document.querySelector(selector);
            if (contentArea) break;
        }

        if (!contentArea) {
            contentArea = document.body;
        }

        // 使用文本遍历器收集所有文本
        const walker = document.createTreeWalker(
            contentArea,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // 跳过某些特殊元素中的文本
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    
                    const tagName = parent.tagName?.toLowerCase();
                    if (['script', 'style', 'noscript', 'iframe', 'object', 'embed'].includes(tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    // 检查是否在编辑器内部（避免重复处理）
                    if (parent.closest('.notion-formula-editor') || 
                        parent.closest('.notion-overlay-container') ||
                        parent.closest('#formula-floating-ball') ||
                        parent.closest('#progress-overlay')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        // 收集文本节点并组合相邻节点
        let currentFormula = '';
        let formulaNodes = [];
        let node;
        
        while (node = walker.nextNode()) {
            const text = node.textContent;
            
            // 检查是否是公式的一部分
            if (text.includes('$')) {
                currentFormula += text;
                formulaNodes.push(node);
                
                // 检查下一个节点
                const nextNode = walker.nextNode();
                if (nextNode) {
                    const nextText = nextNode.textContent;
                    // 如果下一个节点紧跟着且可能是公式的继续
                    if (!nextText.startsWith(' ') && !nextText.startsWith('\n')) {
                        // 回退walker
                        walker.previousNode();
                        continue;
                    }
                    walker.previousNode();
                }
                
                // 尝试提取公式
                const extractedFormulas = extractFormulasFromText(currentFormula);
                for (const formula of extractedFormulas) {
                    const uniqueKey = formula.content + '|' + formulaNodes[0]?.parentElement?.textContent?.substring(0, 50);
                    if (!processedTexts.has(uniqueKey)) {
                        processedTexts.add(uniqueKey);
                        formulas.push({
                            ...formula,
                            nodes: [...formulaNodes]
                        });
                    }
                }
                
                // 重置
                currentFormula = '';
                formulaNodes = [];
            } else if (currentFormula) {
                // 如果当前正在收集公式，但遇到了不包含$的文本
                currentFormula += text;
                formulaNodes.push(node);
                
                // 检查是否应该结束
                if (text.includes('\n') || text.includes('。') || text.includes('.') || text.includes('，')) {
                    const extractedFormulas = extractFormulasFromText(currentFormula);
                    for (const formula of extractedFormulas) {
                        const uniqueKey = formula.content + '|' + formulaNodes[0]?.parentElement?.textContent?.substring(0, 50);
                        if (!processedTexts.has(uniqueKey)) {
                            processedTexts.add(uniqueKey);
                            formulas.push({
                                ...formula,
                                nodes: [...formulaNodes]
                            });
                        }
                    }
                    currentFormula = '';
                    formulaNodes = [];
                }
            }
        }

        // 处理最后可能残留的公式
        if (currentFormula) {
            const extractedFormulas = extractFormulasFromText(currentFormula);
            for (const formula of extractedFormulas) {
                const uniqueKey = formula.content + '|' + formulaNodes[0]?.parentElement?.textContent?.substring(0, 50);
                if (!processedTexts.has(uniqueKey)) {
                    processedTexts.add(uniqueKey);
                    formulas.push({
                        ...formula,
                        nodes: [...formulaNodes]
                    });
                }
            }
        }

        console.log(`找到 ${formulas.length} 个公式`);
        return formulas;
    }

    // 从文本中提取公式 - 改进版，支持复杂嵌套
    function extractFormulasFromText(text) {
        const formulas = [];
        const processedRanges = [];
        
        // 改进的块级公式匹配 - 使用非贪婪匹配并处理嵌套
        // 匹配 $$...$$ 格式，支持内部包含 $ 符号
        let pos = 0;
        while (pos < text.length) {
            const blockStart = text.indexOf('$$', pos);
            if (blockStart === -1) break;
            
            // 查找配对的结束符
            let blockEnd = blockStart + 2;
            let depth = 0;
            let inBackslash = false;
            
            while (blockEnd < text.length) {
                if (text[blockEnd] === '\\' && !inBackslash) {
                    inBackslash = true;
                    blockEnd++;
                    continue;
                }
                
                if (!inBackslash && text.substring(blockEnd, blockEnd + 2) === '$$') {
                    // 找到结束符
                    const content = text.substring(blockStart + 2, blockEnd).trim();
                    if (content && content.length > 0) {
                        formulas.push({
                            type: 'block',
                            content: content,
                            fullMatch: text.substring(blockStart, blockEnd + 2),
                            startIndex: blockStart,
                            endIndex: blockEnd + 2
                        });
                        processedRanges.push({
                            start: blockStart,
                            end: blockEnd + 2
                        });
                    }
                    pos = blockEnd + 2;
                    break;
                }
                
                inBackslash = false;
                blockEnd++;
            }
            
            if (blockEnd >= text.length) {
                // 没有找到结束符，跳过
                pos = blockStart + 2;
            }
        }
        
        // 匹配内联公式 $...$
        pos = 0;
        while (pos < text.length) {
            const inlineStart = text.indexOf('$', pos);
            if (inlineStart === -1) break;
            
            // 检查是否在已处理的块级公式范围内
            const isInBlock = processedRanges.some(range => 
                inlineStart >= range.start && inlineStart < range.end
            );
            
            if (isInBlock) {
                pos = inlineStart + 1;
                continue;
            }
            
            // 检查是否是 $$ 的一部分
            if (text[inlineStart + 1] === '$') {
                pos = inlineStart + 2;
                continue;
            }
            
            // 查找配对的结束符
            let inlineEnd = inlineStart + 1;
            let inBackslash = false;
            
            while (inlineEnd < text.length) {
                if (text[inlineEnd] === '\\' && !inBackslash) {
                    inBackslash = true;
                    inlineEnd++;
                    continue;
                }
                
                if (!inBackslash && text[inlineEnd] === '$' && text[inlineEnd + 1] !== '$') {
                    // 找到结束符
                    const content = text.substring(inlineStart + 1, inlineEnd).trim();
                    
                    // 检查内容是否有效（不能为空，不能包含过多换行）
                    if (content && content.length > 0 && !content.includes('\n\n')) {
                        // 再次检查是否与已有公式重叠
                        const overlaps = processedRanges.some(range => 
                            (inlineStart >= range.start && inlineStart < range.end) ||
                            (inlineEnd + 1 > range.start && inlineEnd + 1 <= range.end)
                        );
                        
                        if (!overlaps) {
                            formulas.push({
                                type: 'inline',
                                content: content,
                                fullMatch: text.substring(inlineStart, inlineEnd + 1),
                                startIndex: inlineStart,
                                endIndex: inlineEnd + 1
                            });
                            processedRanges.push({
                                start: inlineStart,
                                end: inlineEnd + 1
                            });
                        }
                    }
                    pos = inlineEnd + 1;
                    break;
                }
                
                // 如果遇到下一个未转义的 $ 且不是结束符，说明不是有效的公式
                if (!inBackslash && text[inlineEnd] === '$' && inlineEnd !== inlineStart + 1) {
                    pos = inlineStart + 1;
                    break;
                }
                
                inBackslash = false;
                inlineEnd++;
            }
            
            if (inlineEnd >= text.length) {
                // 没有找到结束符
                pos = inlineStart + 1;
            }
        }
        
        // 按照在文本中的位置排序
        formulas.sort((a, b) => a.startIndex - b.startIndex);
        
        // 输出调试信息
        console.log(`提取到 ${formulas.length} 个公式:`, formulas.map(f => ({
            type: f.type,
            length: f.content.length,
            preview: f.content.substring(0, 50) + (f.content.length > 50 ? '...' : '')
        })));
        
        return formulas;
    }

    // Handle conversion
    async function handleConvert() {
        if (isProcessing || formulaCount === 0) return;

        isProcessing = true;
        shouldStopProcessing = false;
        convertBtn.classList.add('processing');
        progressOverlay.classList.add('visible');
        floatingBall.classList.add('active');

        const formulas = getAllFormulas();
        const total = formulas.length;
        let converted = 0;
        let failed = 0;

        for (let i = 0; i < formulas.length; i++) {
            if (shouldStopProcessing) {
                progressStatus.textContent = `转换已停止 (${converted}/${total})`;
                break;
            }

            const formula = formulas[i];
            const formulaTypeText = formula.type === 'block' ? '块级' : '内联';
            const isLongFormula = formula.content.length > 200;
            
            progressStatus.textContent = `转换${formulaTypeText} (${i + 1}/${total})`;
            progressBar.style.width = `${((i + 1) / total) * 100}%`;

            try {
                const result = await convertFormula(formula);
                if (result) {
                    converted++;
                } else {
                    failed++;
                    console.warn(`${formulaTypeText}公式转换失败 (${formula.content.length} 字符):`, formula.content.substring(0, 100));
                }
            } catch (error) {
                failed++;
                console.error(`转换${formulaTypeText}公式出错:`, error, formula);
            }

            // 根据公式复杂度调整等待时间
            const waitTime = isLongFormula ? 500 : 300;
            await sleep(waitTime);
        }

        const message = shouldStopProcessing 
            ? `已停止 (成功: ${converted}, 失败: ${failed})`
            : `完成 (成功: ${converted}, 失败: ${failed})`;
        
        progressStatus.textContent = message;
        
        setTimeout(() => {
            progressOverlay.classList.remove('visible');
            floatingBall.classList.remove('active');
            convertBtn.classList.remove('processing');
            isProcessing = false;
            updateFloatingBall();
        }, 2000);
    }

    // Stop conversion
    function stopConversion() {
        shouldStopProcessing = true;
        progressStatus.textContent = '正在停止...';
    }

    // Convert single formula - 修复版本，增强长公式处理
    async function convertFormula(formula) {
        if (shouldStopProcessing) return false;

        const formulaLength = formula.content.length;
        const isLongFormula = formulaLength > 200;
        
        console.log(`开始转换${formula.type === 'block' ? '块级' : '内联'}公式 (${formulaLength} 字符): "${formula.content.substring(0, 50)}${formulaLength > 50 ? '...' : ''}"`);

        try {
            const selected = await selectFormulaText(formula.fullMatch);
            if (!selected) {
                console.warn('无法选中公式文本，尝试备用方法');
                // 对于长公式，可能需要特殊处理
                if (isLongFormula) {
                    await sleep(200);
                    // 再尝试一次
                    const retrySelected = await selectFormulaText(formula.fullMatch);
                    if (!retrySelected) {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            await sleep(isLongFormula ? 200 : 100);
            
            // 根据公式类型点击不同的按钮
            const clicked = await clickFormula(formula.type);
            if (!clicked) {
                pressEscape();
                return false;
            }

            await sleep(isLongFormula ? 300 : 200);
            const area = await findOperationArea();
            if (!area) {
                pressEscape();
                return false;
            }

            const inputElement = await findEditorInput(area);
            if (!inputElement) {
                console.error('找不到输入框');
                pressEscape();
                return false;
            }

            // 对长公式增加额外的处理时间
            inputElement.focus();
            await simulateTyping(inputElement);
            await sleep(isLongFormula ? 200 : 100);

            // 清空输入框
            if (inputElement.tagName === 'TEXTAREA') {
                inputElement.value = '';
            } else {
                inputElement.textContent = '';
                inputElement.innerText = '';
            }
            
            await sleep(50);

            // 分段输入长公式，避免一次性输入导致的问题
            if (isLongFormula) {
                console.log('使用分段输入方式处理长公式');
                const chunkSize = 500;
                const chunks = [];
                
                for (let i = 0; i < formula.content.length; i += chunkSize) {
                    chunks.push(formula.content.substring(i, Math.min(i + chunkSize, formula.content.length)));
                }

                for (const chunk of chunks) {
                    if (inputElement.tagName === 'TEXTAREA') {
                        inputElement.value += chunk;
                        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        inputElement.textContent += chunk;
                        inputElement.innerText += chunk;
                        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    await sleep(50);
                }
                
                // 最终触发change事件
                inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                // 短公式直接输入
                if (inputElement.tagName === 'TEXTAREA') {
                    inputElement.value = formula.content;
                    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    inputElement.textContent = formula.content;
                    inputElement.innerText = formula.content;
                    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }

            await sleep(isLongFormula ? 300 : 100);

            // 查找Done按钮
            const doneButton = await findButton(area, {
                buttonText: ['Done', '完成', 'Confirm', '确认', 'OK'],
                attempts: isLongFormula ? 50 : 30,
                delay: isLongFormula ? 150 : 100,
                shouldStop: () => shouldStopProcessing
            });

            if (doneButton) {
                await simulateClick(doneButton);
                console.log(`${formula.type === 'block' ? '块级' : '内联'}公式转换成功 (${formulaLength} 字符)`);
                await sleep(isLongFormula ? 400 : 200);
                return true;
            }

            // 如果没找到按钮，尝试按Enter键
            console.log('未找到Done按钮，尝试按Enter键');
            inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            await sleep(50);
            inputElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true }));
            await sleep(200);
            
            // 检查是否成功
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

    // Click Formula button - 修复版本，支持新的SVG图标和公式类型
    async function clickFormula(formulaType = 'inline') {
        if (shouldStopProcessing) return false;

        await sleep(100);

        // 根据公式类型准备不同的文本匹配
        const blockTexts = ['block equation', 'block', '块级公式', '公式块'];
        const inlineTexts = ['inline equation', 'inline', '内联公式', 'formula'];
        const genericTexts = ['formula', 'equation', '公式'];

        // 尝试多种方式查找Formula按钮
        const buttonSelectors = [
            // 文本按钮 - 优先查找特定类型
            ...(formulaType === 'block' ? 
                blockTexts.map(text => `div[role="button"]:has-text("${text}")`) : 
                inlineTexts.map(text => `div[role="button"]:has-text("${text}")`)),
            
            // 通用文本按钮
            ...genericTexts.map(text => `div[role="button"]:has-text("${text}")`),
            
            // SVG按钮 - 支持多种类名
            'div[role="button"]:has(svg.equation)',
            'div[role="button"]:has(svg.squareRootSmall)',
            'div[role="button"]:has(svg[class*="square"])',
            'div[role="button"]:has(svg[class*="root"])',
            'div[role="button"]:has(svg[class*="equation"])',
            'div[role="button"]:has(svg[class*="formula"])',
            
            // 通过SVG路径特征查找（平方根符号特征）
            'div[role="button"]:has(svg path[d*="M15.425"])',
            'div[role="button"]:has(svg path[d*="M14.5"])',
            
            // 通用SVG按钮（作为后备）
            '.notion-overlay-container div[role="button"]:has(svg)'
        ];

        // 首先尝试通过选择器查找
        for (const selector of buttonSelectors) {
            try {
                const buttons = document.querySelectorAll(selector);
                for (const button of buttons) {
                    // 检查按钮是否可见
                    if (button.offsetWidth > 0 && button.offsetHeight > 0) {
                        // 额外检查：确保不是其他功能的按钮
                        const text = button.textContent.toLowerCase();
                        const svg = button.querySelector('svg');
                        
                        // 如果是块级公式，优先选择包含"block"的按钮
                        if (formulaType === 'block' && text && text.includes('block')) {
                            await simulateClick(button);
                            console.log('点击了Block Equation按钮');
                            return true;
                        }
                        
                        // 如果是内联公式，优先选择包含"inline"的按钮
                        if (formulaType === 'inline' && text && text.includes('inline')) {
                            await simulateClick(button);
                            console.log('点击了Inline Equation按钮');
                            return true;
                        }
                        
                        // 如果有文本，检查是否包含相关关键词
                        if (text && (text.includes('formula') || text.includes('equation') || text.includes('公式'))) {
                            await simulateClick(button);
                            console.log(`点击了Formula文本按钮 (${formulaType})`);
                            return true;
                        }
                        
                        // 如果有SVG，检查类名或属性
                        if (svg) {
                            const svgClass = svg.getAttribute('class') || '';
                            const svgViewBox = svg.getAttribute('viewBox') || '';
                            
                            // 检查是否是公式相关的SVG
                            if (svgClass.includes('square') || 
                                svgClass.includes('root') || 
                                svgClass.includes('equation') ||
                                svgClass.includes('formula') ||
                                svgViewBox === '0 0 16 16') {  // Notion的标准图标尺寸
                                
                                // 进一步检查SVG内容（通过path特征）
                                const paths = svg.querySelectorAll('path');
                                for (const path of paths) {
                                    const d = path.getAttribute('d') || '';
                                    // 检查是否包含平方根符号的特征路径
                                    if (d.includes('15.425') || d.includes('14.5') || d.includes('3.4')) {
                                        await simulateClick(button);
                                        console.log(`点击了Formula SVG按钮 (${formulaType})`);
                                        return true;
                                    }
                                }
                                
                                // 如果没有明确的路径特征，但类名匹配，也尝试点击
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
                // 某些选择器可能不被支持，继续尝试其他的
                continue;
            }
        }

        // 后备方案：查找所有按钮并逐个检查
        const allButtons = document.querySelectorAll('[role="button"]');
        for (const button of allButtons) {
            if (button.offsetWidth > 0 && button.offsetHeight > 0) {
                const svg = button.querySelector('svg');
                if (svg) {
                    // 检查SVG是否在悬浮菜单中
                    const overlay = button.closest('.notion-overlay-container');
                    if (overlay && overlay.style.display !== 'none') {
                        // 获取按钮位置，通常Formula按钮在菜单的特定位置
                        const rect = button.getBoundingClientRect();
                        const svgClass = svg.getAttribute('class') || '';
                        
                        // 检查SVG特征
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

    // Select formula text - 改进版，处理长文本和特殊字符
    async function selectFormulaText(formulaText) {
        if (!formulaText || shouldStopProcessing) return false;

        try {
            // 获取页面主编辑器
            const editor = document.querySelector('[data-content-editable-root="true"], .notion-page-content');
            if (!editor) {
                console.error('找不到编辑器');
                return false;
            }

            // 清除现有选区
            const selection = window.getSelection();
            selection.removeAllRanges();

            // 对于超长公式，可能需要特殊处理
            if (formulaText.length > 500) {
                console.log(`处理长公式 (${formulaText.length} 字符)`);
                await sleep(50);
            }

            // 使用自定义查找函数
            const result = findTextInElement(editor, formulaText);
            if (result) {
                const range = document.createRange();
                range.setStart(result.startNode, result.startOffset);
                range.setEnd(result.endNode, result.endOffset);
                selection.addRange(range);
                
                // 触发选择事件
                document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                await sleep(100); // 增加延迟，确保选择完成
                
                // 验证选择
                const selectedText = selection.toString();
                // 移除美元符号后比较
                const cleanFormula = formulaText.replace(/^\$+|\$+$/g, '');
                const cleanSelected = selectedText.replace(/^\$+|\$+$/g, '');
                
                if (cleanSelected.includes(cleanFormula) || cleanFormula.includes(cleanSelected)) {
                    console.log(`成功选中公式文本 (${formulaText.length} 字符)`);
                    return true;
                }
            }

            // 如果自定义查找失败，尝试分段查找（用于超长公式）
            if (formulaText.length > 100) {
                console.log('尝试分段查找长公式');
                // 取公式的前部分进行定位
                const searchPart = formulaText.substring(0, 50);
                const partResult = findTextInElement(editor, searchPart);
                
                if (partResult) {
                    // 从找到的位置开始，尝试扩展选区
                    const range = document.createRange();
                    range.setStart(partResult.startNode, partResult.startOffset);
                    
                    // 尝试找到完整的公式结束位置
                    let currentNode = partResult.startNode;
                    let currentOffset = partResult.startOffset;
                    let remainingText = formulaText;
                    
                    while (currentNode && remainingText.length > 0) {
                        const nodeText = currentNode.textContent || '';
                        const availableText = nodeText.substring(currentOffset);
                        
                        if (remainingText.startsWith(availableText)) {
                            remainingText = remainingText.substring(availableText.length);
                            currentNode = getNextTextNode(currentNode);
                            currentOffset = 0;
                        } else if (availableText.startsWith(remainingText)) {
                            // 找到结束位置
                            range.setEnd(currentNode, currentOffset + remainingText.length);
                            selection.addRange(range);
                            document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                            await sleep(100);
                            console.log('通过分段查找成功选中长公式');
                            return true;
                        } else {
                            break;
                        }
                    }
                }
            }

            // 最后的尝试：使用浏览器的查找功能
            const range = document.createRange();
            range.selectNodeContents(editor);
            selection.addRange(range);

            if (window.find) {
                selection.removeAllRanges();
                // 对于包含特殊字符的公式，可能需要转义
                const searchText = formulaText.length > 200 ? formulaText.substring(0, 200) : formulaText;
                if (window.find(searchText, false, false, false, false, false, false)) {
                    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    await sleep(100);
                    return true;
                }
            }

            console.warn('无法选中公式，可能是文本太长或包含特殊格式');
            return false;
        } catch (error) {
            console.error('选择文本时出错:', error);
            return false;
        }
    }

    // 获取下一个文本节点的辅助函数
    function getNextTextNode(node) {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let currentNode;
        let foundCurrent = false;
        
        while (currentNode = walker.nextNode()) {
            if (foundCurrent) {
                return currentNode;
            }
            if (currentNode === node) {
                foundCurrent = true;
            }
        }
        
        return null;
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

    // Find button with stop check - 增强版本
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
                // 检查SVG
                if (hasSvg) {
                    const svg = btn.querySelector(`svg.${svgClass}`);
                    if (svg) return true;
                    
                    // 检查其他可能的SVG类名
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
                
                // 检查按钮文本
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

    console.log('Notion公式转换工具已加载 (v1.70 - 增强复杂长公式支持)');
})();