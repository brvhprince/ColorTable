/**
 * Project: ColorTable
 * File: DataTable
 * Created by Pennycodes on 6/1/2022.
 * Copyright ColorTable
 */
var ColorTable = /** @class */ (function () {
    function ColorTable(table, options) {
        this.table = table;
        this.options = ColorTable.DefaultOptions();
        for (var k in ColorTable.DefaultOptions()) {
            if (ColorTable.DefaultOptions().hasOwnProperty(k)) {
                if (options.hasOwnProperty(k)) {
                    this.options[k] = options[k];
                }
                else {
                    this.options[k] = ColorTable.DefaultOptions()[k];
                }
            }
        }
        if (options.hasOwnProperty('data')) {
            this.options.data = options.data;
        }
        /* If nb columns not specified, count the number of column from thead. */
        if (this.options.nbColumns < 0) {
            this.options.nbColumns = this.table.tHead.rows[0].cells.length;
        }
        /* Create the base for pagination. */
        this.pagingDivs = document.querySelectorAll(this.options.pagingDivSelector);
        for (var i = 0; i < this.pagingDivs.length; ++i) {
            var div = this.pagingDivs[i];
            this.addClass(div, 'pagination-datatables');
            this.addClass(div, this.options.pagingDivClass);
            var ul = document.createElement('ul');
            this.addClass(ul, this.options.pagingListClass);
            div.appendChild(ul);
        }
        this.pagingLists = document.querySelectorAll(this.options.pagingDivSelector + ' ul');
        this.counterDivs = document.querySelectorAll(this.options.counterDivSelector);
        this.loadingDiv = document.querySelector(this.options.loadingDivSelector);
        if (!this.table.tHead) {
            this.table.tHead = document.createElement('thead');
            this.table.appendChild(this.table.rows[0]);
        }
        /* Compatibility issue (forceStrings => No defined data types). */
        if (this.options.forceStrings) {
            this.options.dataTypes = false;
        }
        this.ths = this.table.tHead.rows[0].cells;
        if (!this.table.tBodies[0]) {
            this.table.tBodies[0] = document.createElement('tbody');
        }
        if (this.options.data instanceof Array) {
            this.data = this.options.data;
        }
        else if (this.options.data instanceof Object) {
            var ajaxOptions = ColorTable.DefaultAjaxOptions();
            for (var k in this.options.data) {
                ajaxOptions[k] = this.options.data[k];
            }
            this.options.data = ajaxOptions;
            var fetchData = true;
            if (fetchData) {
                if (this.table.dataset.size !== undefined) {
                    this.options.data.size = parseInt(this.table.dataset.size, 10);
                }
                this.data = [];
                if (this.options.data.serverPaging) {
                    this.serverPaging = true;
                }
                this.loadingDiv.innerHTML = "<div class=\"progress datatable-load-bar\">\n                        <div class=\"progress-bar progress-bar-striped active\" style=\"width: 0%;\">\n                        </div></div>";
                this.getAjaxDataAsync(0);
            }
        }
        else if (this.table.tBodies[0].rows.length > 0) {
            var i = void 0;
            this.data = [];
            var rows = this.table.tBodies[0].rows;
            var nCols = rows[0].cells.length;
            for (i = 0; i < rows.length; ++i) {
                this.data.push([]);
            }
            for (var j = 0; j < nCols; ++j) {
                var dt = function (x) {
                    return x;
                };
                if (this.options.dataTypes instanceof Array) {
                    switch (this.options.dataTypes[j]) {
                        case 'int':
                            dt = parseInt;
                            break;
                        case 'float':
                        case 'double':
                            dt = parseFloat;
                            break;
                        case 'date':
                        case 'datetime':
                            dt = function (x) { return new Date(x); };
                            break;
                        case false:
                        case true:
                        case 'string':
                        case 'str':
                            dt = function (x) { return x; };
                            break;
                        default:
                            dt = this.options.dataTypes[j];
                    }
                }
                for (i = 0; i < rows.length; ++i) {
                    this.data[i].push(dt(rows[i].cells[j].innerHTML.trim()));
                }
            }
            if (this.options.dataTypes === true) {
                for (var c = 0; c < this.data[0].length; ++c) {
                    var isNumeric = true;
                    for (i = 0; i < this.data.length; ++i) {
                        if (this.data[i][c] !== ""
                            && !((this.data[i][c] - parseFloat(this.data[i][c]) + 1) >= 0)) {
                            isNumeric = false;
                        }
                    }
                    if (isNumeric) {
                        for (i = 0; i < this.data.length; ++i) {
                            if (this.data[i][c] !== "") {
                                this.data[i][c] = parseFloat(this.data[i][c]);
                            }
                        }
                    }
                }
            }
        }
        /* Add sorting class to all th and add callback. */
        this.createSort();
        /* Add filter where it's needed. */
        this.createFilter();
        this.triggerSort();
        this.filter();
    }
    /**
     *
     * Add the specified class(es) to the specified DOM Element.
     *
     * @param node The DOM Element
     * @param classes (Array or String)
     *
     **/
    ColorTable.prototype.addClass = function (node, classes) {
        if (typeof classes === "string") {
            classes = classes.split(' ');
        }
        classes.forEach(function (c) {
            if (!c)
                return;
            node.classList.add(c);
        });
    };
    /**
     *
     * Remove the specified node from the DOM.
     *
     * @param node The node to removes
     *
     **/
    ColorTable.prototype.removeNode = function (node) {
        if (node)
            node.parentNode.removeChild(node);
    };
    /**
     *
     * Clear size option and set timeout (if specified) for refresh.
     *
     * Note: This function should be call when the ajax loading is finished.
     *
     * @update refreshTimeOut The new timeout
     *
     **/
    ColorTable.prototype.setRefreshTimeout = function () {
        if (this.options.data.refresh) {
            clearTimeout(this.refreshTimeOut);
            this.refreshTimeOut = setTimeout((function (datatable) {
                return function () { datatable.getAjaxDataAsync(0); };
            })(this), this.options.data.refresh);
        }
    };
    /**
     *
     * Hide the loading divs.
     *
     **/
    ColorTable.prototype.hideLoadingDivs = function () {
        this.removeNode(this.loadingDiv);
    };
    /**
     *
     * Update the loading divs with the current % of data load (according
     * to this.options.data.size).
     *
     * Note: Call setRefreshTimeout & hideLoadingDivs if all the data have been loaded.
     *
     **/
    ColorTable.prototype.updateLoadingDivs = function () {
        if (this.data.length >= this.options.data.size) {
            this.setRefreshTimeout();
            this.hideLoadingDivs();
        }
        else {
            this.loadingDiv.querySelector('div.progress .progress-bar').style.width =
                parseInt(String(100 * this.data.length / this.options.data.size), 10) + '%';
        }
    };
    /**
     *
     * Get data according to this.options.data, asynchronously, recursively.
     *
     * @param start The first offset to send to the server
     *
     *
     * @update data Concat data received from server to old data
     *
     * Note: Each call increment start by pageSize * pagingNumberOfPages.
     *
     **/
    ColorTable.prototype.getAjaxDataAsync = function (start) {
        var xhr = new XMLHttpRequest();
        xhr.timeout = this.options.data.timeout;
        xhr.onreadystatechange = function (datatable, start) {
            return function () {
                if (this.readyState === 4) {
                    switch (this.status) {
                        case 200:
                        case 201:
                            if (datatable.serverPaging) {
                                datatable.totalPage = this.response.total;
                                datatable.data = this.response.data;
                            }
                            else {
                                datatable.data = datatable.data.concat(this.response);
                            }
                            datatable.updateLoadingDivs();
                            datatable.sort(true);
                            break;
                        default:
                            console.error("ERROR: " + this.status + " - " + this.statusText);
                            console.log(xhr);
                            alert('An error occurred. Check console for details');
                            break;
                    }
                }
            };
        }(this, start);
        var url = this.options.data.url;
        // const limit = this.options.pageSize * this.options.pagingNumberOfPages
        var limit = this.options.pageSize;
        var formData = new FormData();
        if (start > -1 && this.serverPaging) {
            if (this.options.data.type.toUpperCase() == 'GET') {
                url += '?start=' + start + '&limit=' + limit;
            }
            else {
                formData.append('offset', start.toString());
                formData.append('limit', limit.toString());
            }
        }
        xhr.open(this.options.data.type, url, true);
        xhr.responseType = 'json';
        xhr.send(formData);
    };
    /**
     *
     * @return The last page number according to options.pageSize and
     * current number of filtered elements.
     *
     **/
    ColorTable.prototype.getLastPageNumber = function () {
        var lastPage = this.serverPaging ? this.totalPage : this.filterIndex.length;
        return parseInt(String(Math.ceil(lastPage / this.options.pageSize)), 10);
    };
    /**
     * Creating Pagination Links
     * @param content The link content, this is the page numbers
     * @param page the indexing page
     * @param disabled disable page link
     * @private
     */
    ColorTable.prototype.createPagingLink = function (content, page, disabled) {
        var link = document.createElement('a');
        // Check options...
        if (this.options.pagingLinkClass) {
            link.classList.add(this.options.pagingLinkClass);
        }
        if (this.options.pagingLinkHref) {
            link.href = this.options.pagingLinkHref;
        }
        if (this.options.pagingLinkDisabledTabIndex !== false && disabled) {
            link.tabIndex = Number(this.options.pagingLinkDisabledTabIndex);
        }
        link.dataset.page = page;
        link.innerHTML = content;
        return link;
    };
    /**
     *
     * Update the paging divs.
     *
     **/
    ColorTable.prototype.updatePaging = function () {
        /* Be careful if you change something here, all this part calculate the first
                 and last page to display. I chose to center the current page, it's more beautiful... */
        var totalPage = this.serverPaging ? this.totalPage : this.filterIndex.length;
        var nbPages = this.options.pagingNumberOfPages;
        var dataTable = this;
        var cp = parseInt(String(this.currentStart / this.options.pageSize), 10) + 1;
        var lp = this.getLastPageNumber();
        var start;
        var end;
        var first = totalPage ? this.currentStart + 1 : 0;
        var last = (this.currentStart + this.options.pageSize) > totalPage ?
            totalPage : this.currentStart + this.options.pageSize;
        if (cp < nbPages / 2) {
            start = 1;
        }
        else if (cp >= lp - nbPages / 2) {
            start = lp - nbPages + 1;
            if (start < 1) {
                start = 1;
            }
        }
        else {
            start = parseInt(String(cp - nbPages / 2 + 1), 10);
        }
        if (start + nbPages < lp + 1) {
            end = start + nbPages - 1;
        }
        else {
            end = lp;
        }
        /* Just iterate over each paging list and append li to ul. */
        var li;
        var _loop_1 = function (i) {
            var children = [];
            if (dataTable.options.firstPage) {
                li = document.createElement('li');
                li.appendChild(dataTable.createPagingLink(dataTable.options.firstPage, "first", cp === 1));
                if (cp === 1)
                    li.classList.add('active');
                children.push(li);
            }
            if (dataTable.options.prevPage) {
                li = document.createElement('li');
                li.appendChild(dataTable.createPagingLink(dataTable.options.prevPage, "prev", cp === 1));
                if (cp === 1)
                    li.classList.add('active');
                children.push(li);
            }
            if (dataTable.options.pagingPages) {
                if (typeof this_1.options.pagingPages !== "boolean") {
                    var _children = this_1.options.pagingPages.call(this_1.table, start, end, cp, first, last);
                    if (_children instanceof Array) {
                        children = children.concat(_children);
                    }
                    else {
                        children.push(_children);
                    }
                }
            }
            else {
                for (var k = start; k <= end; k++) {
                    li = document.createElement('li');
                    li.appendChild(dataTable.createPagingLink(k, k, cp === k));
                    if (k === cp)
                        li.classList.add('active');
                    children.push(li);
                }
            }
            if (dataTable.options.nextPage) {
                li = document.createElement('li');
                li.appendChild(dataTable.createPagingLink(dataTable.options.nextPage, "next", cp === lp || lp === 0));
                if (cp === lp || lp === 0)
                    li.classList.add('active');
                children.push(li);
            }
            if (dataTable.options.lastPage) {
                li = document.createElement('li');
                li.appendChild(dataTable.createPagingLink(dataTable.options.lastPage, "last", cp === lp || lp === 0));
                if (cp === lp || lp === 0)
                    li.classList.add('active');
                children.push(li);
            }
            this_1.pagingLists[i].innerHTML = '';
            children.forEach(function (e) {
                if (dataTable.options.pagingItemClass) {
                    e.classList.add(dataTable.options.pagingItemClass);
                }
                if (e.childNodes.length > 0) {
                    e.childNodes[0].addEventListener('click', function (event) {
                        event.preventDefault();
                        if (this.parentNode.classList.contains('active') ||
                            typeof this.dataset.page === 'undefined') {
                            return;
                        }
                        switch (this.dataset.page) {
                            case 'first':
                                dataTable.loadPage(1);
                                break;
                            case 'prev':
                                dataTable.loadPage(cp - 1);
                                break;
                            case 'next':
                                dataTable.loadPage(cp + 1);
                                break;
                            case 'last':
                                dataTable.loadPage(lp);
                                break;
                            default:
                                dataTable.loadPage(parseInt(this.dataset.page, 10));
                        }
                    }, false);
                }
                this.pagingLists[i].appendChild(e);
            }, this_1);
        };
        var this_1 = this;
        for (var i = 0; i < this.pagingLists.length; ++i) {
            _loop_1(i);
        }
    };
    /**
     *
     * Update the counter divs.
     *
     **/
    ColorTable.prototype.updateCounter = function () {
        var totalPage = this.serverPaging ? this.totalPage : this.filterIndex.length;
        var cp = totalPage ?
            parseInt(String(this.currentStart / this.options.pageSize), 10) + 1 : 0;
        var lp = parseInt(String(Math.ceil(totalPage / this.options.pageSize)), 10);
        var first = totalPage ? this.currentStart + 1 : 0;
        var last = (this.currentStart + this.options.pageSize) > totalPage ?
            totalPage : this.currentStart + this.options.pageSize;
        for (var i = 0; i < this.counterDivs.length; ++i) {
            this.counterDivs[i].innerHTML = this.options.counterText.call(this.table, cp, lp, first, last, totalPage, this.serverPaging ? this.totalPage : this.data.length);
        }
    };
    /**
     *
     * @return The sort function according to options. Sort, options.sortKey & options.sortDir.
     *
     * Note: This function could return false if no sort function can be generated.
     *
     **/
    ColorTable.prototype.getSortFunction = function () {
        if (!this.options.sort)
            return false;
        if (this.options.sort instanceof Function)
            return this.options.sort;
        if (this.data.length === 0 || !(typeof this.options.sortKey !== "boolean" && this.options.sortKey in this.data[0]))
            return false;
        var key = this.options.sortKey;
        var asc = this.options.sortDir === 'asc';
        if (this.options.sort[key] instanceof Function) {
            return function (s) {
                return function (a, b) {
                    var valA = a[key], valB = b[key];
                    return asc ? s(valA, valB) : -s(valA, valB);
                };
            }(this.options.sort[key]);
        }
        return function (a, b) {
            var ValA = a[key], ValB = b[key];
            if (ValA > ValB)
                return asc ? 1 : -1;
            if (ValA < ValB)
                return asc ? -1 : 1;
            return 0;
        };
    };
    /**
     *
     * Destroy the filters (remove the filter line).
     *
     **/
    ColorTable.prototype.destroyFilter = function () {
        this.removeNode(this.table.querySelector('.datatable-filter-line'));
    };
    /**
     *
     * Change the text input filter placeholder according to this.options.filterText.
     *
     **/
    ColorTable.prototype.changePlaceHolder = function () {
        var placeholder = this.options.filterText ? this.options.filterText : '';
        var inputTexts = this.table.querySelectorAll('.datatable-filter-line input[type="text"]');
        for (var i = 0; i < inputTexts.length; ++i) {
            inputTexts[i].placeholder = placeholder;
        }
    };
    /**
     *
     * Create a text filter for the specified field.
     *
     * @param field The field corresponding to the filter
     *
     * @update filters Add the new filter to the list of filter (calling addFilter)
     *
     * @return The input filter
     *
     **/
    ColorTable.prototype.createTextFilter = function (field) {
        var opt = this.options.filters[field];
        var input = opt instanceof HTMLInputElement ? opt : document.createElement('input');
        input.type = 'text';
        if (this.options.filterText) {
            input.placeholder = this.options.filterText;
        }
        this.addClass(input, 'datatable-filter datatable-input-text');
        input.dataset.filter = field;
        this.filterValues[field] = '';
        var typeWatch = (function () {
            var timer = 0;
            return function (callback, ms) {
                clearTimeout(timer);
                timer = setTimeout(callback, ms);
            };
        })();
        input.onkeyup = function (datatable) {
            return function () {
                // @ts-ignore
                var val = this.value.toUpperCase();
                // @ts-ignore
                var field = this.dataset.filter;
                typeWatch(function () {
                    datatable.filterValues[field] = val;
                    datatable.filter();
                }, 300);
            };
        }(this);
        input.onkeydown = input.onkeyup;
        var regexp = opt === 'regexp' || input.dataset.regexp;
        if (opt instanceof Function) {
            this.addFilter(field, opt);
        }
        else if (regexp) {
            this.addFilter(field, function (data, val) {
                return new RegExp(val).test(String(data));
            });
        }
        else {
            this.addFilter(field, function (data, val) {
                return String(data).toUpperCase().indexOf(val) !== -1;
            });
        }
        this.addClass(input, this.options.filterInputClass);
        return input;
    };
    /**
     * Check if the specified value is in the specified array, without strict type checking.
     *
     * @param value The val to search
     * @param array The array
     *
     * @return true if the value was found in the array
     **/
    ColorTable._isIn = function (value, array) {
        var found = false;
        for (var i = 0; i < array.length && !found; ++i) {
            found = array[i] == value;
        }
        return found;
    };
    /**
     * Return the index of the specified element in the object.
     *
     * @param v
     * @param a
     *
     * @return The index, or -1
     **/
    ColorTable._index = function (v, a) {
        if (a === undefined || a === null) {
            return -1;
        }
        var index = -1;
        for (var i = 0; i < a.length && index == -1; ++i) {
            if (a[i] === v)
                index = i;
        }
        return index;
    };
    /**
     * Return the keys of the specified object.
     *
     * @param obj
     *
     * @return The keys of the specified object.
     **/
    ColorTable._keys = function (obj) {
        if (obj === undefined || obj === null) {
            return undefined;
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k))
                keys.push(k);
        }
        return keys;
    };
    /**
     *
     * Create a select filter for the specified field.
     *
     * @param field The field corresponding to the filter
     *
     * @update filters Add the new filter to the list of filter (calling addFilter)
     *
     * @return The select filter.
     *
     **/
    ColorTable.prototype.createSelectFilter = function (field) {
        var option;
        var opt = this.options.filters[field];
        var values = {}, selected = [], multiple = false, empty = true, emptyValue = this.options.filterEmptySelect;
        var tag;
        if (opt instanceof HTMLSelectElement) {
            tag = opt;
        }
        else if (opt instanceof Object && 'element' in opt && opt.element) {
            tag = opt.element;
        }
        if (opt instanceof HTMLSelectElement || opt === 'select') {
            values = this.getFilterOptions(field);
        }
        else {
            multiple = ('multiple' in opt) && (opt.multiple === true);
            empty = ('empty' in opt) && opt.empty;
            emptyValue = (('empty' in opt) && (typeof opt.empty === 'string')) ?
                opt.empty : this.options.filterEmptySelect;
            if ('values' in opt) {
                if (opt.values === 'auto') {
                    values = this.getFilterOptions(field);
                }
                else {
                    values = opt.values;
                }
                if ('default' in opt) {
                    selected = opt['default'];
                }
                else if (multiple) {
                    selected = [];
                    for (var k in values) {
                        if (values[k] instanceof Object) {
                            selected = selected.concat(ColorTable._keys(values[k]));
                        }
                        else {
                            selected.push(k);
                        }
                    }
                }
                else {
                    selected = [];
                }
                if (!(selected instanceof Array)) {
                    selected = [selected];
                }
            }
            else {
                values = opt;
                selected = multiple ? ColorTable._keys(values) : [];
            }
        }
        var select = tag ? tag : document.createElement('select');
        if (multiple) {
            select.multiple = true;
        }
        if (opt['default']) {
            select.dataset['default'] = opt['default'];
        }
        this.addClass(select, 'datatable-filter datatable-select');
        select.dataset.filter = field;
        if (empty) {
            var option_1 = document.createElement('option');
            option_1.dataset.empty = "true";
            option_1.value = "";
            option_1.innerHTML = emptyValue;
            select.appendChild(option_1);
        }
        var allKeys = [];
        for (var key in values) {
            if (values[key] instanceof Object) {
                var optgroup = document.createElement('optgroup');
                optgroup.label = key;
                for (var sKey in values[key]) {
                    if (values[key].hasOwnProperty(sKey)) {
                        allKeys.push(sKey);
                        option = document.createElement('option');
                        option.value = sKey;
                        option.selected = ColorTable._isIn(sKey, selected);
                        option.innerHTML = values[key][sKey];
                        optgroup.appendChild(option);
                    }
                }
                select.appendChild(optgroup);
            }
            else {
                allKeys.push(key);
                option = document.createElement('option');
                option.value = key;
                option.selected = ColorTable._isIn(key, selected);
                option.innerHTML = values[key];
                select.appendChild(option);
            }
        }
        var val = select.value;
        if (multiple) {
            val = [];
            for (var i = 0; i < select.options.length; ++i) {
                if (select.options[i].selected)
                    val.push(select.options[i].value);
            }
        }
        this.filterValues[field] = multiple ? val : ((empty && !val) ? allKeys : [val]);
        select.onchange = function (allKeys, multiple, empty, datatable) {
            return function () {
                var val = this.value;
                if (multiple) {
                    val = [];
                    for (var i = 0; i < this.options.length; ++i) {
                        if (this.options[i].selected)
                            val.push(this.options[i].value);
                    }
                }
                var field = this.dataset.filter;
                datatable.filterValues[field] = multiple ? val : ((empty && !val) ? allKeys : [val]);
                datatable.filter();
            };
        }(allKeys, multiple, empty, this);
        if (opt instanceof Object && opt.fn instanceof Function) {
            this.addFilter(field, opt.fn);
            select.dataset.filterType = 'function';
        }
        else {
            this.addFilter(field, function (aKeys, datatable) {
                return function (data, val) {
                    if (!val)
                        return false;
                    if (val == aKeys && !data)
                        return true;
                    return ColorTable._isIn(data, val);
                };
            }(allKeys, this));
            select.dataset.filterType = 'default';
        }
        this.addClass(select, this.options.filterSelectClass);
        return select;
    };
    /**
     *
     * Create the filter line according to options.filters.
     *
     **/
    ColorTable.prototype.createFilter = function () {
        this.filters = [];
        this.filterTags = [];
        this.filterValues = [];
        // Special options if '*'
        if (this.options.filters === '*') {
            var nThs = this.table.tHead.rows[0].cells.length;
            this.options.filters = [];
            while (nThs--) {
                this.options.filters.push(true);
            }
        }
        if (this.options.filters) {
            var filterLine = false;
            var tr = document.createElement('tr');
            tr.classList.add('datatable-filter-line');
            for (var field in this.options.filters) {
                if (this.options.filters.hasOwnProperty(field)) {
                    var td = document.createElement('td');
                    if (this.options.filters[field] !== false) {
                        var opt = this.options.filters[field];
                        var input = opt === true || opt === 'regexp' || opt === 'input' || opt instanceof Function || opt instanceof HTMLInputElement;
                        var filter = input ? this.createTextFilter(field) : this.createSelectFilter(field);
                        this.filterTags[field] = filter;
                        if (!document.body.contains(filter)) {
                            td.classList.add('datatable-filter-cell');
                            td.appendChild(filter);
                        }
                    }
                    if (!(this.options.filters[field] instanceof Object) || !this.options.filters[field].noColumn) {
                        tr.appendChild(td);
                    }
                }
            }
            if (tr.querySelectorAll('td.datatable-filter-cell').length > 0) {
                this.table.tHead.appendChild(tr);
            }
        }
    };
    /**
     *
     * Filter data and refresh.
     *
     * @param keepCurrentPage true if the current page should not be changed (on refresh
     *      for example), if not specified or false, the current page will be set to 0.
     *
     * @update filterIndex Will contain the new filtered indexes
     * @update currentStart The new starting point
     *
     **/
    ColorTable.prototype.filter = function (keepCurrentPage) {
        if (typeof keepCurrentPage === 'undefined')
            keepCurrentPage = false;
        var oldCurrentStart = this.currentStart;
        this.currentStart = 0;
        this.filterIndex = [];
        for (var i = 0; i < this.data.length; i++) {
            if (this.checkFilter(this.data[i])) {
                // @ts-ignore
                this.filterIndex.push(i);
            }
        }
        if (keepCurrentPage) {
            this.currentStart = oldCurrentStart;
            var totalPage = this.serverPaging ? this.totalPage : this.filterIndex.length;
            while (this.currentStart >= totalPage)
                this.currentStart -= this.options.pageSize;
            if (this.currentStart < 0)
                this.currentStart = 0;
        }
        if (this.options.filterSelectOptions && this.filterIndex.length > 0) {
            var i = void 0, j = void 0;
            var allKeys = [];
            for (j = 0; j < this.data[0].length; ++j) {
                allKeys.push({});
            }
            for (i = 0; i < this.filterIndex.length; ++i) {
                var row = this.data[this.filterIndex[i]];
                for (j = 0; j < row.length; ++j) {
                    allKeys[j][row[j]] = true;
                }
            }
            for (var k = 0; k < allKeys.length; ++k) {
                var keys = ColorTable._keys(allKeys[k]);
                if (this.filterTags[k]
                    && this.filterTags[k] instanceof HTMLSelectElement
                    && this.filterTags[k].dataset.filterType == 'default') {
                    var options = this.filterTags[k].childNodes;
                    for (i = 0; i < options.length; ++i) {
                        if (!options[i].dataset.empty) {
                            options[i].style.display = ColorTable._isIn(options[i].value, keys)
                                ? 'block' : 'none';
                        }
                    }
                }
            }
        }
        this.refresh();
    };
    /**
     *
     * Reset all filters.
     *
     **/
    ColorTable.prototype.resetFilters = function () {
        var datatable = this;
        this.filterTags.forEach(function (e) {
            var allKeys, i;
            var field = e.dataset.filter;
            if (e instanceof HTMLInputElement) {
                e.value = '';
                datatable.filterValues[field] = '';
            }
            else {
                if (e.multiple) {
                    allKeys = [];
                    for (i = 0; i < e.childNodes.length; ++i) {
                        e.childNodes[i].selected = true;
                        allKeys.push(e.childNodes[i].value);
                    }
                    datatable.filterValues[field] = allKeys;
                }
                else if (e.dataset['default']
                    && e.querySelector('option[value="' + e.dataset['default'] + '"]').length > 0) {
                    for (i = 0; i < e.childNodes.length; ++i) {
                        e.childNodes[i].selected = e.childNodes[i].value == e.dataset['default'];
                    }
                    datatable.filterValues[field] = [e.dataset['default']];
                }
                else if (e.childNodes.length > 0) {
                    e.childNodes[0].selected = true;
                    for (i = 1; i < e.childNodes.length; ++i) {
                        e.childNodes[i].selected = false;
                    }
                    if (e.childNodes[0].dataset.empty) {
                        allKeys = [];
                        for (i = 1; i < e.childNodes.length; ++i) {
                            allKeys.push(e.childNodes[i].value);
                        }
                        datatable.filterValues[field] = allKeys;
                    }
                    else {
                        datatable.filterValues[field] = [e.childNodes[0].value];
                    }
                }
            }
        });
        this.filter();
    };
    /**
     * Strip HTML tags for the specified string.
     *
     * @param str The string from which tags must be stripped.
     *
     * @return The string with HTML tags removed.
     *
     **/
    ColorTable.stripTags = function (str) {
        return str.replace(/<\/?[^>]+(>|$)/g, "");
    };
    /**
     *
     * Check if the specified data match the filters according to this.filters
     * and this.filterValues.
     *
     * @param data The data to check
     *
     * @return true if the data match the filters, false otherwise
     *
     **/
    ColorTable.prototype.checkFilter = function (data) {
        var ok = true;
        for (var fk in this.filters) {
            var currentData = fk[0] === '_' ? data : data[fk];
            if (typeof currentData === "string") {
                currentData = ColorTable.stripTags(currentData);
            }
            if (!this.filters[fk](currentData, this.filterValues[fk])) {
                ok = false;
                break;
            }
        }
        return ok;
    };
    /**
     *
     * Add a new filter.
     *
     * @update filters
     *
     **/
    ColorTable.prototype.addFilter = function (field, filter) {
        this.filters[field] = filter;
    };
    /**
     *
     * Get the filter select options for a specified field according
     * to this.data.
     *
     * @return The options found.
     *
     **/
    ColorTable.prototype.getFilterOptions = function (field) {
        var options = {}, values = [];
        for (var key in this.data) {
            if (this.data[key][field] !== '') {
                values.push(this.data[key][field]);
            }
        }
        values.sort();
        for (var i in values) {
            if (values.hasOwnProperty(i)) {
                var txt = ColorTable.stripTags(values[i]);
                options[txt] = txt;
            }
        }
        return options;
    };
    /**
     *
     * Remove class, data and event on sort headers.
     *
     **/
    ColorTable.prototype.destroySort = function () {
        var sort = document.querySelector('thead th');
        sort.classList.remove('sorting sorting-asc sorting-desc');
        // sort.removeEventListener('click',data)
    };
    /**
     *
     * Add class, event & data to headers according to this.options.sort or data-sort attribute
     * of headers.
     *
     * @update options.sort Will be set to true if not already and a data-sort attribute is found.
     *
     **/
    ColorTable.prototype.createSort = function () {
        var dataTable = this;
        if (!(this.options.sort instanceof Function)) {
            var countTH = 0;
            var ths = this.ths;
            for (var i = 0; i < ths.length; ++i) {
                if (ths[i].dataset.sort) {
                    dataTable.options.sort = true;
                }
                else if (dataTable.options.sort === '*') {
                    ths[i].dataset.sort = String(countTH);
                }
                else {
                    var key = void 0;
                    if (dataTable.options.sort instanceof Array) {
                        key = countTH;
                    }
                    else if (dataTable.options.sort instanceof Object) {
                        key = ColorTable._keys(dataTable.options.sort)[countTH];
                    }
                    if (key !== undefined && dataTable.options.sort[key]) {
                        ths[i].dataset.sort = key;
                    }
                }
                if (ths[i].dataset.sort !== undefined) {
                    ths[i].classList.add('sorting');
                }
                countTH++;
                ths[i].addEventListener('click', function () {
                    if (this.dataset.sort) {
                        if (this.classList.contains('sorting-asc')) {
                            dataTable.options.sortDir = 'desc';
                            this.classList.remove('sorting-asc');
                            this.classList.add('sorting-desc');
                        }
                        else if (this.classList.contains('sorting-desc')) {
                            dataTable.options.sortDir = 'asc';
                            this.classList.remove('sorting-desc');
                            this.classList.add('sorting-asc');
                        }
                        else {
                            // @ts-ignore
                            var others = this.parentNode.cells;
                            for (var j = 0; j < others.length; j++) {
                                others[j].classList.remove('sorting-desc');
                                others[j].classList.remove('sorting-asc');
                            }
                            dataTable.options.sortDir = 'asc';
                            dataTable.options.sortKey = this.dataset.sort;
                            this.classList.add('sorting-asc');
                        }
                        dataTable.sort();
                        dataTable.refresh();
                    }
                }, false);
            }
        }
    };
    /**
     *
     * Trigger sort event on the table: If options.sort is a function,
     * sort the table, otherwiae trigger click on the column specified by options.sortKey.
     *
     **/
    ColorTable.prototype.triggerSort = function () {
        if (this.options.sort instanceof Function) {
            this.sort();
            this.refresh();
        }
        else if (this.options.sortKey !== false) {
            var th = void 0;
            for (var j = 0; j < this.ths.length; j++) {
                this.ths[j].classList.remove('sorting-desc');
                this.ths[j].classList.remove('sorting-asc');
                if (this.ths[j].dataset.sort === this.options.sortKey) {
                    th = this.ths[j];
                }
            }
            if (th !== undefined) {
                th.classList.add('sorting-' + this.options.sortDir);
                this.sort();
                this.refresh();
            }
        }
    };
    /**
     *
     * Sort the data.
     *
     * @update data
     *
     **/
    ColorTable.prototype.sort = function (keepCurrentPage) {
        var fnSort = this.getSortFunction();
        if (fnSort !== false) {
            // @ts-ignore
            this.data.sort(fnSort);
        }
        this.filter(keepCurrentPage);
    };
    /**
     *
     * Try to identify the specified data with the specific identifier according
     * to this.options.identify.
     *
     * @return true if the data match, false otherwise
     *
     **/
    ColorTable.prototype.identify = function (id, data) {
        if (this.options.identify === false) {
            return false;
        }
        if (this.options.identify instanceof Function) {
            return this.options.identify(id, data);
        }
        // @ts-ignore
        return data[this.options.identify] == id;
    };
    /**
     *
     * Find the index of the first element matching id in the data array.
     *
     * @param id The id to find (will be match according to this.options.identify)
     *
     * @return The index of the first element found, or -1 if no element is found
     *
     **/
    ColorTable.prototype.indexOf = function (id) {
        var index = -1;
        for (var i = 0; i < this.data.length && index === -1; i++) {
            if (this.identify(id, this.data[i])) {
                index = i;
            }
        }
        return index;
    };
    /**
     *
     * Get an elements from the data array.
     *
     * @param id An identifier for the element (see this.options.identify)
     *
     **/
    ColorTable.prototype.row = function (id) {
        if (this.options.identify === true) {
            return this.data[id];
        }
        return this.data[this.indexOf(id)];
    };
    /**
     *
     * Retrieve all data.
     *
     *
     **/
    ColorTable.prototype.all = function (filter) {
        if (typeof filter === "undefined"
            || filter === true) {
            return this.data;
        }
        var returnData = [];
        for (var i = 0; i < this.data.length; ++i) {
            if (filter(this.data[i])) {
                returnData.push(this.data[i]);
            }
        }
        return returnData;
    };
    /**
     *
     * Add an element to the data array.
     *
     * @param data The element to add
     *
     * @update data
     *
     **/
    ColorTable.prototype.addRow = function (data) {
        this.data.push(data);
        if (typeof this.syncData !== "undefined") {
            this.syncData.toAdd.push(data);
        }
        this.sort();
        this.filter();
        this.currentStart = parseInt(String(ColorTable._index(ColorTable._index(data, this.data), this.filterIndex)
            / this.options.pageSize), 10) * this.options.pageSize;
        this.refresh();
    };
    /**
     *
     * Add elements to the data array.
     *
     * @param data Array of elements to add
     *
     * @update data
     *
     **/
    ColorTable.prototype.addRows = function (data) {
        this.data = this.data.concat(data);
        if (typeof this.syncData !== "undefined") {
            this.syncData.toAdd = this.syncData.toAdd.concat(data);
        }
        this.sort();
        this.filter();
        this.currentStart = parseInt(String(ColorTable._index(ColorTable._index(data, this.data), this.filterIndex)
            / this.options.pageSize), 10) * this.options.pageSize;
        this.refresh();
    };
    /**
     *
     * Remove an element from the data array.
     *
     * @param id An identifier for the element (see this.options.identify)
     *
     **/
    ColorTable.prototype.deleteRow = function (id) {
        var oldCurrentStart = this.currentStart;
        var index = this.indexOf(id);
        if (index === -1) {
            console.log('No data found with id: ' + id);
            return;
        }
        this.data.splice(index, 1);
        if (typeof this.syncData !== "undefined") {
            this.syncData.toDelete.push(id);
        }
        this.filter();
        if (oldCurrentStart < this.filterIndex.length) {
            this.currentStart = oldCurrentStart;
        }
        else {
            this.currentStart = oldCurrentStart - this.options.pageSize;
            if (this.currentStart < 0)
                this.currentStart = 0;
        }
        this.refresh();
    };
    /**
     *
     * Delete all elements matching the filter arg.
     *
     **/
    ColorTable.prototype.deleteAll = function (filter) {
        var oldCurrentStart = this.currentStart;
        var newData = [];
        if (typeof this.syncData !== "undefined") {
            this.syncData.toDelete.push(filter);
        }
        for (var i = 0; i < this.data.length; ++i) {
            if (!filter(this.data[i])) {
                newData.push(this.data[i]);
            }
        }
        this.data = newData;
        this.filter();
        if (oldCurrentStart < this.filterIndex.length) {
            this.currentStart = oldCurrentStart;
        }
        else {
            this.currentStart = oldCurrentStart - this.options.pageSize;
            if (this.currentStart < 0)
                this.currentStart = 0;
        }
        this.refresh();
    };
    /**
     *
     * Update an element in the data array. Will add the element if it is not found.
     *
     * @param id An identifier for the element (see this.options.identify)
     * @param data The new data (identifier value will be set to id)
     *
     **/
    ColorTable.prototype.updateRow = function (id, data) {
        var index = this.indexOf(id);
        if (typeof this.syncData !== "undefined") {
            this.syncData.toUpdate[id] = data;
        }
        if (index !== -1) {
            if (id in data) {
                delete data[id];
            }
            for (var key in this.data[index]) {
                if (key in data) {
                    this.data[index][key] = data[key];
                }
            }
            this.sort();
            this.filter();
            this.currentStart = parseInt(String(ColorTable._index(this.indexOf(id), this.filterIndex)
                / this.options.pageSize), 10) * this.options.pageSize;
            this.refresh();
        }
    };
    /**
     *
     * Change the current page and refresh.
     *
     * @param page The number of the page to load
     *
     * @update currentStart
     *
     **/
    ColorTable.prototype.loadPage = function (page) {
        var oldPage = this.currentStart / this.options.pageSize;
        if (page < 1) {
            page = 1;
        }
        else if (page > this.getLastPageNumber()) {
            page = this.getLastPageNumber();
        }
        this.currentStart = (page - 1) * this.options.pageSize;
        if (this.serverPaging) {
            // this.updateLoadingDivs()
            //TODO: Show loading div
            this.getAjaxDataAsync(this.currentStart);
        }
        else {
            this.refresh();
        }
        this.options.onChange.call(this.table, oldPage + 1, page);
    };
    /**
     *
     * @return The current page
     *
     **/
    ColorTable.prototype.getCurrentPage = function () {
        return this.currentStart / this.options.pageSize + 1;
    };
    /**
     *
     * Refresh the page according to current page (DO NOT SORT).
     * This function call options.lineFormat.
     *
     **/
    ColorTable.prototype.refresh = function () {
        this.options.beforeRefresh.call(this.table);
        this.updatePaging();
        this.updateCounter();
        this.table.tBodies[0].innerHTML = "";
        if (this.serverPaging) {
            for (var i = 0; i < this.options.pageSize && i + this.currentStart < this.totalPage; i++) {
                var data = this.data[i];
                this.table.tBodies[0].appendChild(this.options.lineFormat.call(this.table, i, data));
            }
        }
        else {
            if (this.currentStart >= this.data.length) {
                this.table.tBodies[0].innerHTML = "<tr><td colspan=\"' + this.options.nbColumns + '\">\n                <div class=\"progress progress-striped active\">\n                <div class=\"bar\" style=\"width: 100%;\"></div>\n                </div></div></tr>";
                return;
            }
            for (var i = 0; i < this.options.pageSize && i + this.currentStart < this.filterIndex.length; i++) {
                var index = this.filterIndex[this.currentStart + i];
                var data = this.data[index];
                this.table.tBodies[0].appendChild(this.options.lineFormat.call(this.table, index, data));
            }
        }
        this.options.afterRefresh.call(this.table);
    };
    ColorTable.prototype.reload = function () {
        var xhr = new XMLHttpRequest();
        xhr.timeout = this.options.data.timeout;
        xhr.onreadystatechange = function (datatable) {
            return function () {
                if (this.readyState == 4) {
                    switch (this.status) {
                        case 200:
                            datatable.data = this.response;
                            datatable.sort(true);
                            break;
                        case 404:
                        case 500:
                            console.error("ERROR: " + this.status + " - " + this.statusText);
                            console.log(xhr);
                            break;
                        default:
                            datatable.reload();
                            break;
                    }
                }
            };
        }(this);
        var url = this.options.data.url;
        xhr.open(this.options.data.type, url, true);
        xhr.responseType = 'json';
        xhr.send();
    };
    /**
     *
     * Set a option and refresh the table if necessary.
     *
     * @param key The name of the option to change
     * @param val The new option value
     *
     * @update options
     *
     **/
    ColorTable.prototype.setOption = function (key, val) {
        if (key in this.options) {
            this.options[key] = val;
            if (key === 'sort') {
                this.destroySort();
                this.createSort();
                this.triggerSort();
            }
            if (key === 'sortKey' || key === 'sortDir') {
                this.sort();
            }
            if (key === 'filters') {
                this.destroyFilter();
                this.createFilter();
            }
            if (key === 'filterText') {
                this.changePlaceHolder();
            }
            this.filter();
        }
    };
    /**
     *
     * Set a list of options and refresh the table if necessary.
     *
     * @param options A list of options to set (plain object)
     *
     * @update options
     *
     **/
    ColorTable.prototype.setOptions = function (options) {
        for (var key in options) {
            if (key in this.options) {
                this.options[key] = options[key];
            }
        }
        if ('sort' in options) {
            this.destroySort();
            this.createSort();
            this.triggerSort();
        }
        else if ('sortKey' in options || 'sortDir' in options) {
            this.sort();
        }
        if ('filters' in options) {
            this.destroyFilter();
            this.createFilter();
        }
        if ('filterText' in options) {
            this.changePlaceHolder();
        }
        this.filter();
    };
    /**
     *
     * Remove all the elements added by the datatable.
     *
     **/
    ColorTable.prototype.destroy = function () {
        var i;
        if (this.refreshTimeOut !== undefined) {
            clearTimeout(this.refreshTimeOut);
        }
        this.destroySort();
        for (i = 0; i < this.pagingDivs.length; ++i) {
            this.pagingDivs[i].classList.remove('pagination-datatable');
            this.pagingDivs[i].classList.remove(this.options.pagingDivClass);
            this.pagingDivs[i].innerHTML = '';
        }
        this.destroyFilter();
        this.table.classList.remove(this.options.tableClass);
        this.removeNode(this.table.tBodies[0]);
        this.table.appendChild(document.createElement('tbody'));
        for (i = 0; i < this.data.length; i++) {
            var index = this.filterIndex[this.currentStart + i];
            var data = this.data[index];
            this.table.tBodies[0].appendChild(this.options.lineFormat.call(this.table, index, data));
        }
    };
    /**
     * Initialize ColorTable
     * @param selector
     * @param options
     */
    ColorTable.init = function (selector, options) {
        return new ColorTable(selector, options);
    };
    ColorTable.DefaultOptions = function () {
        return {
            /**
             * Specify whether the type of the column should be deduced or not. If this option
             * is true, the type is not deduced (mainly here for backward compatibility).
             *
             * @see dataTypes
             */
            forceStrings: false,
            /**
             * Specify the class of the table.
             *
             */
            tableClass: 'datatable',
            /**
             * Specify the selector for the paging div element.
             *
             */
            pagingDivSelector: '.paging',
            /**
             * Specify the class for the paging div element.
             *
             */
            pagingDivClass: 'text-center',
            /**
             * Specify the class for the paging list element.
             *
             */
            pagingListClass: 'pagination',
            /**
             * Specify the class for the paging list item elements.
             *
             */
            pagingItemClass: '',
            /**
             * Specify the class for the paging list link elements.
             *
             */
            pagingLinkClass: '',
            /**
             * Specify the href attribute for the paging list link elements.
             *
             */
            pagingLinkHref: '',
            /**
             * Specify the tabindex attribute for the paging list link elements when
             * disabled.
             *
             */
            pagingLinkDisabledTabIndex: false,
            /**
             * Specify the selector for the counter div element.
             *
             * @see counterText
             */
            counterDivSelector: '.counter',
            /**
             * Specify the selector the loading div element.
             *
             * @see data
             */
            loadingDivSelector: '.loading',
            /**
             * Sepcify the sort options.
             *
             * @type boolean|string|Array|Object
             */
            sort: false,
            /**
             * Specify the default sort key.
             *
             * @type boolean|int|string.
             */
            sortKey: false,
            /**
             * Specify the default sort directions, 'asc' or 'desc'.
             *
             */
            sortDir: 'asc',
            /**
             * Specify the number of columns, a value of -1 (default) specify
             * the the number of columns should be retrieved for the <thead>
             * elements of the table.
             *
             */
            nbColumns: -1,
            /**
             * Specify the number of elements to display per page.
             *
             */
            pageSize: 20,
            /**
             * Specify the number of pages to display in the paging list element.
             *
             */
            pagingNumberOfPages: 9,
            /**
             * Specify the way of identifying items from the data array:
             *
             *   - if this option is false (default), no identification is provided.
             *   - if a Function is specified, the function is used to identify:
             *         function (id, item) -> boolean
             *   - if an int or a string is specified, items are identified by the
             *     value corresponding to the key.
             *
             * @type boolean|int|string|Function.
             *
             */
            identify: false,
            /**
             * Callback function when the table is updated.
             *
             */
            onChange: function (oldPage, newPage) { },
            /**
             * Function used to generate content for the counter div element.
             *
             */
            counterText: function (currentPage, totalPage, firstRow, lastRow, totalRow, totalRowUnfiltered) {
                var counterText = 'Page ' + currentPage + ' on ' + totalPage
                    + '. Showing ' + firstRow + ' to ' + lastRow + ' of ' + totalRow + ' entries';
                if (totalRow != totalRowUnfiltered) {
                    counterText += ' (filtered from ' + totalRowUnfiltered + ' total entries)';
                }
                counterText += '.';
                return counterText;
            },
            /**
             * Content of the paging item pointing to the first page.
             *
             */
            firstPage: '&lt;&lt;',
            /**
             * Content of the paging item pointing to the previous page.
             *
             */
            prevPage: '&lt;',
            /**
             *
             */
            pagingPages: false,
            /**
             * Content of the paging item pointing to the next page.
             *
             */
            nextPage: '&gt;',
            /**
             * Content of the paging item pointing to the last page.
             *
             */
            lastPage: '&gt;&gt;',
            /**
             * Specify the type of the columns:
             *
             *   - if false, the type is not deduced and values are treated as strings.
             *   - if true, the type is deduced automatically.
             *   - if an Array is specified, the type of each column is retrieve from the
             *     array values, possible values are 'int', 'float' <> 'double', 'date' <> 'datetime',
             *     false <> true <> 'string' <> 'str'. A function can also be specified to convert
             *     the value.
             *
             * @see forceStrings
             *
             */
            dataTypes: true,
            /**
             * Specify the filter options.
             *
             */
            filters: [],
            /**
             * Specify the placeholder for the textual input filters.
             */
            filterText: 'Search... ',
            /**
             * Specify the placeholder for the select input filters.
             */
            filterEmptySelect: '',
            /**
             *
             */
            filterSelectOptions: false,
            /**
             *
             */
            filterInputClass: 'form-control',
            /**
             *
             */
            filterSelectClass: 'form-control',
            /**
             * Callback function before the display is reloaded.
             *
             */
            beforeRefresh: function () { },
            /**
             * Callback function after the display has been reloaded.
             *
             */
            afterRefresh: function () { },
            /**
             * Function used to generate the row of the table.
             *
             */
            lineFormat: function (id, data) {
                var res = document.createElement('tr');
                res.dataset.id = id;
                for (var key in data) {
                    if (data.hasOwnProperty(key)) {
                        res.innerHTML += '<td>' + data[key] + '</td>';
                    }
                }
                return res;
            }
        };
    };
    ColorTable.DefaultAjaxOptions = function () {
        return {
            url: null,
            timeout: 2000,
            type: 'get',
            serverPaging: false,
            refresh: undefined,
        };
    };
    return ColorTable;
}());
