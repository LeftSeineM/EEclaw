/**
 * 做了如下修改：
 * 1、汉化为中文显示
 * 2、去掉休息日设置，硬编码为周六日；不显示today,none按钮，日期选择行为改为弹出式
 * 3、进行外部包装，使用弹出窗口显示日期，双击获取。
 */
 
// The DatePicker constructor
// oDate : Date Optional argument representing the date to select
function DatePicker( oDate ) {
	//oDate = obj.
	// check arguments
	if ( arguments.length == 0 ) {
		this._selectedDate = new Date;
		this._none = false;
	}
	else {
		this._selectedDate = oDate || new Date();
		this._none = oDate == null;
	}

	this._matrix = [[],[],[],[],[],[],[]];
	//this._showNone = false;
	//this._showToday = true;
	this._firstWeekDay = 0;	// start week with monday according to standards 
	//this._redWeekDay = 6;	// sunday is the default red day.

	this._dontChangeNone = false;
}

// two static fields describing the name of the months abd days
DatePicker.months = [
	"一月", "二月", "三月", "四月",
	"五月", "六月", "七月", "八月",
	"九月", "十月", "十一月", "十二月"];
DatePicker.days = ["一", "二", "三", "四", "五", "六","日"];


DatePicker.prototype.onchange = function () {};

// create the nodes inside the date picker
DatePicker.prototype.create = function ( doc ) {
	if ( doc == null ) doc = document;

	this._document = doc;

	// create elements
	this._el = doc.createElement( "div" );
	this._el.className = "datePicker";

	// header
	var div = doc.createElement( "div" );
	div.className = "header";
	this._el.appendChild( div );

	var headerTable = doc.createElement( "table" );
	headerTable.className = "headerTable";
	headerTable.cellSpacing = 0;
	div.appendChild( headerTable );

	var tBody = doc.createElement( "tbody" );
	headerTable.appendChild( tBody );

	var tr = doc.createElement( "tr" );
	tBody.appendChild( tr );

	var td = doc.createElement( "td" );
	this._previousMonth = doc.createElement( "button" );
	this._previousMonth.className = "previousButton";
	this._previousMonth.setAttribute("value","&lt;");
	this._previousMonth.setAttribute("type", "button");
	td.appendChild( this._previousMonth );
	tr.appendChild( td );

	td = doc.createElement( "td" );
	td.className = "labelContainer";
	tr.appendChild( td );

	this._topLabel = doc.createElement( "a" );
	this._topLabel.className = "topLabel";
	this._topLabel.href = "#";
	this._topLabel.appendChild( doc.createTextNode( String.fromCharCode( 160 ) ) );
	td.appendChild( this._topLabel );

	this._labelPopup = doc.createElement( "div" );
	this._labelPopup.className = "labelPopup";
	// no insertion

	td = doc.createElement( "td" );
	this._nextMonth = doc.createElement( "button" );
	this._nextMonth.className = "nextButton";
	this._nextMonth.setAttribute("value","&gt;");
	this._nextMonth.setAttribute("type", "button");
	td.appendChild( this._nextMonth );
	tr.appendChild( td );

	// grid
	div = doc.createElement( "div" );
	div.className = "grid";
	this._el.appendChild( div );
	this._table = div;

	// footer
	div = doc.createElement( "div" );
	div.className = "footer";
	this._el.appendChild( div );

	var footerTable = doc.createElement( "table" );
	footerTable.className = "footerTable";
	footerTable.cellSpacing = 0;
	div.appendChild( footerTable );

	tBody = doc.createElement( "tbody" );
	footerTable.appendChild( tBody );

	tr = doc.createElement( "tr" );
	tBody.appendChild( tr );

	td = doc.createElement( "td" );
	td.appendChild( doc.createTextNode( "提示：双击选定。" ) );
	/*this._todayButton = doc.createElement( "button" );
	this._todayButton.className = "todayButton";
	this._todayButton.setAttribute("type", "button");
	this._todayButton.appendChild( doc.createTextNode( "Today" ) );
	td.appendChild( this._todayButton );*/
	tr.appendChild( td );

	this._createTable( doc );

	this._updateTable();
	this._setTopLabel();

	// IE55+ extension
	this._previousMonth.hideFocus = true;
	this._nextMonth.hideFocus = true;
	// end IE55+ extension

	// hook up events
	var dp = this;
	// buttons
	this._previousMonth.onclick = function () {
		dp._dontChangeNone = true;
		dp.goToPreviousMonth();
		dp._dontChangeNone = false;
	};
	this._nextMonth.onclick = function () {
		dp._dontChangeNone = true;
		dp.goToNextMonth();
		dp._dontChangeNone = false;
	};

	this._el.onselectstart = function () {
		return false;
	};

	this._table.onclick = function ( e ) {
		// find event
		if ( e == null ) e = doc.parentWindow.event;

		// find td
		var el = e.target != null ? e.target : e.srcElement;
		while ( el.nodeType != 1 )
			el = el.parentNode;
		while ( el != null && el.tagName && el.tagName.toLowerCase() != "td" )
			el = el.parentNode;

		// if no td found, return
		if ( el == null || el.tagName == null || el.tagName.toLowerCase() != "td" )
			return;

		var d = new Date( dp._selectedDate );
		var n = Number( el.firstChild.data );
		if ( isNaN( n ) || n <= 0 || n == null )
			return;

		d.setDate( n );
		dp.setDate( d );
	};
	
  // show popup
	this._topLabel.onclick = function ( e ) {
		dp._showLabelPopup();
		return false;
	};

	this._el.onkeydown = function ( e ) {
		if ( e == null ) e = doc.parentWindow.event;
		var kc = e.keyCode != null ? e.keyCode : e.charCode;

		if ( kc < 37 || kc > 40 ) return true;

		var d = new Date( dp._selectedDate ).valueOf();
		if ( kc == 37 ) // left
			d -= 24 * 60 * 60 * 1000;
		else if ( kc == 39 ) // right
			d += 24 * 60 * 60 * 1000;
		else if ( kc == 38 ) // up
			d -= 7 * 24 * 60 * 60 * 1000;
		else if ( kc == 40 ) // down
			d += 7 * 24 * 60 * 60 * 1000;

		dp.setDate( new Date( d ) );
		return false;
	}

	// ie6 extension
	this._el.onmousewheel = function ( e ) {
		if ( e == null ) e = doc.parentWindow.event;
		var n = - e.wheelDelta / 120;
		var d = new Date( dp._selectedDate );
		var m = d.getMonth() + n;
		d.setMonth( m );


		dp._dontChangeNone = true;
		dp.setDate( d );
		dp._dontChangeNone = false;

		return false;
	}

	return this._el;
};

DatePicker.prototype.setDate = function ( oDate ) {

	this._hideLabelPopup();

	// if null then set None
	if ( oDate == null ) {
		if ( !this._none ) {
			this._none = true;
			this._setTopLabel();
			this._updateTable();

			if ( typeof this.onchange == "function" )
				this.onchange();
		}
		return;
	}

	// if string or number create a Date object
	if ( typeof oDate == "string" || typeof oDate == "number" ) {
		oDate = new Date( oDate );
	}


	// do not update if not really changed
	if ( this._selectedDate.getDate() != oDate.getDate() ||
		this._selectedDate.getMonth() != oDate.getMonth() ||
		this._selectedDate.getFullYear() != oDate.getFullYear() ||
		this._none ) {

		if ( !this._dontChangeNone )
			this._none = false;

		this._selectedDate = new Date( oDate );

		this._setTopLabel();
		this._updateTable();

		if ( typeof this.onchange == "function" )
			this.onchange();
	}

	if ( !this._dontChangeNone )
		this._none = false;
}


DatePicker.prototype.getDate = function () {
	if ( this._none ) return null;
	return new Date( this._selectedDate );	// create a new instance
}

// creates the table elements and inserts them into the date picker
DatePicker.prototype._createTable = function ( doc ) {
	var str, i;
	var rows = 6;
	var cols = 7;
	var currentWeek = 0;

	var table = doc.createElement( "table" );
	table.className = "gridTable";
	table.cellSpacing = 0;

	var tBody = doc.createElement( "tbody" );
	table.appendChild( tBody );

	// days row
	var tr = doc.createElement( "tr" );
	tr.className = "daysRow";

	var td, tn;
	var nbsp = String.fromCharCode( 160 );
	for ( i = 0; i < cols; i++ ) {
		td = doc.createElement( "td" );
		td.appendChild( doc.createTextNode( nbsp ) );
		tr.appendChild( td );
	}
	tBody.appendChild( tr );

	// upper line
	tr = doc.createElement( "tr" );
	td = doc.createElement( "td" );
	td.className = "upperLine";
	td.colSpan = 7;
	tr.appendChild( td );
	tBody.appendChild( tr );

	// rest
	for ( i = 0; i < rows; i++ ) {
		tr = doc.createElement( "tr" );
		for ( var j = 0; j < cols; j++ ) {
			td = doc.createElement( "td" );
			td.appendChild( doc.createTextNode( nbsp ) );
			tr.appendChild( td );
		}
		tBody.appendChild( tr );
	}
	str += "</table>";

	if ( this._table != null )
		this._table.appendChild( table )
};
// this method updates all the text nodes inside the table as well
// as all the classNames on the tds
DatePicker.prototype._updateTable = function () {
	// if no element no need to continue
	if ( this._table == null ) return;

	var i;
	var str = "";
	var rows = 6;
	var cols = 7;
	var currentWeek = 0;

	var cells = new Array( rows );
	this._matrix = new Array( rows )
	for ( i = 0; i < rows; i++ ) {
		cells[i] = new Array( cols );
		this._matrix[i] = new Array( cols );
	}

	// Set the tmpDate to this month
	var tmpDate = new Date( this._selectedDate.getFullYear(),
							this._selectedDate.getMonth(), 1 );
	var today = new Date();
	// go thorugh all days this month and store the text
	// and the class name in the cells matrix
	for ( i = 1; i < 32; i++ ) {
		tmpDate.setDate( i );
		// convert to ISO, Monday is 0 and 6 is Sunday
		var weekDay = ( tmpDate.getDay() + 6 ) % 7;
		var colIndex = ( weekDay - this._firstWeekDay + 7 ) % 7;
		if ( tmpDate.getMonth() == this._selectedDate.getMonth() ) {

			var isToday = tmpDate.getDate() == today.getDate() &&
						tmpDate.getMonth() == today.getMonth() &&
						tmpDate.getFullYear() == today.getFullYear();

			cells[currentWeek][colIndex] = { text: "", className: "" };

			if ( this._selectedDate.getDate() == tmpDate.getDate() && !this._none )
				cells[currentWeek][colIndex].className += "selected ";
			if ( isToday )
				cells[currentWeek][colIndex].className += "today ";
			if ( ( tmpDate.getDay() + 6 ) % 7 == 5 || ( tmpDate.getDay() + 6 ) % 7 == 6 ){ // 硬编码周六日为休息日
			  cells[currentWeek][colIndex].className += "red";
			}

			cells[currentWeek][colIndex].text =
				this._matrix[currentWeek][colIndex] = tmpDate.getDate();

			if ( colIndex == 6 )
				currentWeek++;
		}
	}

	// fix day letter order if not standard
	var weekDays = DatePicker.days;
	if (this._firstWeekDay != 0) {
		weekDays = new Array(7);
		for ( i = 0; i < 7; i++)
			weekDays[i] = DatePicker.days[ (i + this._firstWeekDay) % 7];
	}

	// update text in days row
	var tds = this._table.firstChild.tBodies[0].rows[0].cells;
	for ( i = 0; i < cols; i++ )
		tds[i].firstChild.data = weekDays[i];

	// update the text nodes and class names
	var trs = this._table.firstChild.tBodies[0].rows;
	var tmpCell;
	var nbsp = String.fromCharCode( 160 );
	for ( var y = 0; y < rows; y++ ) {
		for (var x = 0; x < cols; x++) {
			tmpCell = trs[y + 2].cells[x];
			if ( typeof cells[y][x] != "undefined" ) {
				tmpCell.className = cells[y][x].className;
				tmpCell.firstChild.data = cells[y][x].text;
			}
			else {
				tmpCell.className = "";
				tmpCell.firstChild.data = nbsp;
			}
		}
	}
}

// sets the label showing the year and selected month
DatePicker.prototype._setTopLabel = function () {
	var str = this._selectedDate.getFullYear() + " " + DatePicker.months[ this._selectedDate.getMonth() ];
	if ( this._topLabel != null )
		this._topLabel.lastChild.data = str;
}

DatePicker.prototype.goToNextMonth = function () {
	var d = new Date( this._selectedDate );
	d.setDate( Math.min(d.getDate(), DatePicker.getDaysPerMonth(d.getMonth() + 1,
		d.getFullYear())) ); // no need to catch dec -> jan for the year
	d.setMonth( d.getMonth() + 1 );
	this.setDate( d );
}

DatePicker.prototype.goToPreviousMonth = function () {
	var d = new Date( this._selectedDate );
	d.setDate( Math.min(d.getDate(), DatePicker.getDaysPerMonth(d.getMonth() - 1,
		d.getFullYear())) ); // no need to catch jan -> dec for the year
	d.setMonth( d.getMonth() - 1 );
	this.setDate( d );
}

// 0 is monday and 6 is sunday as in the ISO standard
DatePicker.prototype.setFirstWeekDay = function ( nFirstWeekDay ) {
	if ( this._firstWeekDay != nFirstWeekDay ) {
		this._firstWeekDay = nFirstWeekDay;
		this._updateTable();
	}
}

DatePicker.prototype.getFirstWeekDay = function () {
	return this._firstWeekDay;
}

DatePicker.prototype._showLabelPopup = function () {

	var dateContext = function ( dp, d ) {
		return function ( e ) {
			dp._dontChangeNone = true;
			dp._hideLabelPopup();
			dp.setDate( d );
			dp._dontChangeNone = false;
			return false;
		};
	};

	var dp = this;

	// clear all old elements in the popup
	while ( this._labelPopup.hasChildNodes() )
		this._labelPopup.removeChild( this._labelPopup.firstChild );

	var a, tmp, tmp2;
	for ( var i = -4; i < 5; i++ ) {
		tmp = new Date( this._selectedDate );
		tmp2 = new Date( this._selectedDate );	// need another tmp to catch year change when checking leap
		tmp2.setDate(1);
		tmp2.setMonth( tmp2.getMonth() + i );
		tmp.setDate( Math.min(tmp.getDate(), DatePicker.getDaysPerMonth(tmp.getMonth() + i,
			tmp2.getFullYear())) );
		tmp.setMonth( tmp.getMonth() + i );

		a = this._document.createElement( "a" );
		a.href = "javascript:void 0;";
		a.onclick = dateContext( dp, tmp );
		a.appendChild( this._document.createTextNode( tmp.getFullYear() + " " +
									DatePicker.months[ tmp.getMonth() ] ) );
		if ( i == 0 )
			a.className = "selected";
		this._labelPopup.appendChild( a );
	}

	this._topLabel.parentNode.insertBefore( this._labelPopup, this._topLabel.parentNode.firstChild );
};

DatePicker.prototype._hideLabelPopup = function () {
	if ( this._labelPopup.parentNode )
		this._labelPopup.parentNode.removeChild( this._labelPopup );
};

DatePicker._daysPerMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
DatePicker.getDaysPerMonth = function (nMonth, nYear) {
	nMonth = (nMonth + 12) % 12;
	var res = DatePicker._daysPerMonth[nMonth];
	if (nMonth == 1) {
		res += nYear % 4 == 0 && !(nYear % 400 == 0) ? 1 : 0;
	}
	return res;
};

//－－－－－如下函数提供隐藏/恢复指定对象功能－－－－－－－

var HideElementTemp = new Array(); //存放被隐藏的对象数组
//隐藏所有对象
function cal_hideElementAll(){ 
        cal_HideElement("IMG");
        cal_HideElement("SELECT");
        cal_HideElement("OBJECT");
        cal_HideElement("IFRAME");
}

function cal_HideElement(strElementTagName){
  try{
	var tags = document.getElementsByTagName(strElementTagName) || window.document.all.tags(strElementTagName);  
    for(i=0;i<tags.length; i++){
      var objTemp = tags[i];
      if(!objTemp||!objTemp.offsetParent)
         continue;
      HideElementTemp[HideElementTemp.length]=objTemp
      objTemp.style.visibility="hidden";
    }
  }catch(e){alert(e.message)}
}

function cal_ShowElement(){
    var i;
    for(i=0;i<HideElementTemp.length; i++){
      var objTemp = HideElementTemp[i]
      if(!objTemp||!objTemp.offsetParent)
          continue;
      objTemp.style.visibility=''
    }
    HideElementTemp=new Array();
}


//－－－－－ 隐藏/恢复对象模块结束 －－－－－－－


//获取日期，是对DatePicker类的包装，提供给外部
//obj - 与日期选择关联的对象，用户选择的日期会显示在该对象
//pattern - 日期格式。默认yyyy-mm-dd
function pickDate( obj,pattern ){
  var el =  window.event || arguments.callee.caller.arguments[0];
  
  if(obj == null || obj.type == null || obj.type != "text") return ;
  
  if(obj._showDate){ //再次点击时关闭
    document.body.removeChild(obj._showDate);
    obj._showDate = null;
    cal_ShowElement();  //恢复被隐藏的对象
    return;
  }
  
  var dp = new DatePicker(parseStrToDate(obj.value,pattern));
  var d = dp.create();
  document.body.appendChild(d);
  cal_HideElement("SELECT");  //将select框隐藏，避免遮住日期选择层

  d.ondblclick = function ( e ) {//双击选定
    var cur = dp.getDate();
    var datestr;
		if(null != cur){
		  obj.value = convertDateToStr(cur,pattern);
		  pickDate(obj,pattern);
		}
	};
  var dw = document.width ? document.width : document.documentElement.offsetWidth - 25;	
	if (d.offsetWidth >= dw)
		d.style.width = dw - 10 + "px";	else
		d.style.width = "";	
	var scroll = getScroll();
	
	if (el.clientX > d.offsetWidth)
		d.style.left = el.clientX - d.offsetWidth + scroll.x + "px";
	else
		d.style.left = el.clientX - 2 + scroll.x + "px";
	d.style.top = el.clientY + 18 + scroll.y + "px";

	// store a reference to the tooltip div
	obj._showDate = d;
}

function getScroll() {
	if (document.all && document.body.scrollTop != undefined) {	// IE model
		var ieBox = document.compatMode != "CSS1Compat";
		var cont = ieBox ? document.body : document.documentElement;
		return {x : cont.scrollLeft, y : cont.scrollTop};
	}
	else {
		return {x : window.pageXOffset, y : window.pageYOffset};
	}
}

//以下为日期辅助函数
date_fmt=new Array("yyyy-mm-dd","yyyymmdd","yyyy/mm/dd","dd/mm/yyyy"); //支持的转换格式

date_regfmt=new Array("/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/","/^([0-9]{4})([0-9]{2})([0-9]{2})$/","/^([0-9]{4})\\/([0-9]{2})\\/([0-9]{2})$/","/^([0-9]{2})\\/([0-9]{2})\\/([0-9]{4})$/");

date_ordfmt=new Array("123","123","123","321"); //年月日顺序

//将日期类型按指定的格式转换为字符串
//如果转换失败，返回null
function convertDateToStr(date,format){
var year,month,day;

year = date.getFullYear();
month = date.getMonth() + 1;
day = date.getDate();

if(year==null || month==null || day==null) return;
month = month<10 ? "0"+month : month;
day = day<10 ? "0"+day : day;

if(!format) format = date_fmt[0];

format=format.toLowerCase();
for(index=0;index<date_fmt.length;index++){
if(format==date_fmt[index]){ 

format = format.replace("yyyy",year);
format = format.replace("mm",month);
format = format.replace("dd",day);

return format;
}
}

return ;
}

//将字符串按指定的格式转换为日期类型
//如果转换失败，返回null
function parseStrToDate(str,format)
{
var regexp,value,index;
var year,month,day;
var iyear,imonth,iday;
var dateArray;

if(!str) return ;

if(!format) format = date_fmt[0];

format=format.toLowerCase();
for(index=0;index<date_fmt.length;index++)
{
if(format==date_fmt[index])
{ 
eval('regexp='+date_regfmt[index]+';');

iyear=parseInt(date_ordfmt[index].charAt(0));
imonth=parseInt(date_ordfmt[index].charAt(1));
iday=parseInt(date_ordfmt[index].charAt(2));

break;
}
}

if(index==date_fmt.length) return ;

if(regexp.test(str)){
//alert("Date is matched with Format!");
dateArray=str.match(regexp);

year=dateArray[iyear];
month=dateArray[imonth];
day=dateArray[iday];

//alert("The Date you have filled is:\nYear:"+year+"\nMonth:"+month+"\nDay:"+day);

return new Date(year,month-1,day);
}

return;
}