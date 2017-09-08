// Created with Squiffy 5.1.0
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.id = '41ae63e709';
squiffy.story.sections = {
	'_default': {
		'text': "<center><img src=\"resources/title.svg\"/>\n\n<br/><br/><br/><br/>\n\n<h2>A work of (interactive) fiction. Any resemblance to real persons or events is entirely coincidental.</h2>\n</center>\n\n<p><a class=\"squiffy-link link-passage\" data-passage=\"howto\" role=\"link\" tabindex=\"0\">Click here for instructions on how to play.</a></p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"cast\" role=\"link\" tabindex=\"0\">Click here to see the cast.</a>  </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"play\" role=\"link\" tabindex=\"0\">Click here to play.</a></p>",
		'passages': {
			'howto': {
				'text': "<p>It&#39;s simple. Just click on the link which describes what you think the protagonist should do.</p>\n<p>If, at any point, you want to restart the game, click the restart link in the upper right.</p>",
			},
			'cast': {
				'text': "<center>\n<h1>Cast of Characters</h1>\n</center>\n\n<p><br/><br/><br/></p>\n<p><strong>ME:</strong>  The protagonist.</p>\n<p><strong>LO:</strong>  Late October, a fashion model.</p>\n<p><strong>NIQUE:</strong>  Another fashion model. (She&#39;s French.)</p>\n<p><strong>BUD:</strong>  A male fashion model.</p>\n<p><strong>THE GUY:</strong>  Fashion designer, creator and all-around boss.</p>",
			},
		},
	},
	'play': {
		'clear': true,
		'text': "<p><em>Scene: The middle of nowhere.</em></p>\n<p>I caught the wrong bus!</p>\n<p>I can&#39;t believe it! I&#39;m supposed to be in Middle <em>School</em> and here I am in the middle of <em>nowhere</em>. What should I do? <a class=\"squiffy-link link-passage\" data-passage=\"Cry\" role=\"link\" tabindex=\"0\">Cry</a>? <a class=\"squiffy-link link-passage\" data-passage=\"Use my cell phone\" role=\"link\" tabindex=\"0\">Use my cell phone</a>? <a class=\"squiffy-link link-passage\" data-passage=\"Look around\" role=\"link\" tabindex=\"0\">Look around</a>? </p>",
		'passages': {
			'Cry': {
				'text': "<p><strong>ME:</strong> Boo-hoo!</p>\n<p>OK. That felt good.</p>",
			},
			'Use my cell phone': {
				'text': "<p>There&#39;s no reception. This is the middle of nowhere.</p>",
			},
			'Look around': {
				'text': "<p>The only thing in sight is a ramshackle building with a sign I can&#39;t quite read. I&#39;ll need to <a class=\"squiffy-link link-section\" data-section=\"move closer\" role=\"link\" tabindex=\"0\">move closer</a>.</p>",
			},
		},
	},
	'move closer': {
		'text': "<p>Now I can read the sign. It says, &quot;Fashion Show in Progress.&quot; Really? A fashion show in the middle of nowhere? Why?</p>\n<p>Uh-oh. Someone is coming. I don&#39;t know her but she looks oddly familiar.</p>\n<p><strong>LO:</strong> Hi there! I love your bell-bottoms. It&#39;s a real 80&#39;s look!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue1': {
		'clear': true,
		'text': "<table><tr>\n<td><strong>ME:</strong> You look strangely familiar.<br/><br/>\n<strong>LO:</strong> I get that a lot, except for the familiar part.<br/><br/>\n<strong>ME:</strong> Can you help me?<br/><br/>\n<strong>LO:</strong> When are you on the runway?<br/><br/>\n<strong>ME:</strong> Actually, I&#39;m here by mistake. I need a ride back to Middle School.<br/><br/>\n<strong>LO:</strong> Hmm. Well, I&#39;m on the runway in five--the Late October look you know--but I&#39;m sure someone inside can help you.<br/><br/>\n<strong>ME:</strong> OK, thanks. By the way, what kind of material are you wearing? I&#39;ve never seen that before.<br/><br/>\n<strong>LO:</strong> Some kind of synthetic, I think. Gotta run. Good luck.<br/><br/>\n<strong>ME:</strong> (Waving goodbye.) I like your hat!\n</td>\n<td><img src=\"resources/lateoctober.svg\"/></td>\n</tr>\n</table>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue2\" role=\"link\" tabindex=\"0\">I guess I&#39;ll go inside.</a></p>",
		'passages': {
		},
	},
	'_continue2': {
		'clear': true,
		'text': "<p><em>Scene: Inside the ramshackle building.</em></p>\n<center><img src=\"resources/dressingrooms.svg\" /></center>\n\n<p>That sign is confusing. The &quot;MEN&quot; arrow is above the lady icon and the &quot;LADIES&quot; arrow is above the man icon.</p>\n<p>Maybe, instead of &quot;LADIES&quot; they meant &quot;LADDIES&quot; but misspelled it? And maybe the &quot;MEN&quot; label was once &quot;WOMEN&quot; but the &quot;WO&quot; got worn off?</p>\n<p>I don&#39;t know which way to go. Should I go <a class=\"squiffy-link link-section\" data-section=\"mens\" role=\"link\" tabindex=\"0\">LEFT</a> or <a class=\"squiffy-link link-section\" data-section=\"mens\" role=\"link\" tabindex=\"0\">RIGHT</a>?</p>",
		'passages': {
		},
	},
	'mens': {
		'clear': true,
		'text': "<p><em>Scene: Vestibule outside of the men&#39;s dressing room.</em></p>\n<table><tr>\n<td> \n<strong>BUD:</strong> <em>(Entering vestibule from men&#39;s dressing room, swaying as if listening to music, though there are no ear buds in sight.)</em> Hey, there! I like your bell bottoms, but you&#39;re in the wrong place.<br/><br/>\n<strong>ME:</strong> You look strangely familiar.<br/><br/> \n<strong>BUD:</strong> <em>(Swaying, bobbing head,)</em> I get that. You part of the 80&#39;s look?<br/><br/>\n<strong>ME:</strong> To tell the truth, I&#39;m here by mistake. I need a ride back to Middle School.<br/><br/>\n<strong>BUD:</strong> I get that. I bet THE GUY could help you out.<br/><br/> \n<strong>ME:</strong> The guy?<br/><br/> \n<strong>BUD:</strong> THE GUY. He runs the show.<br/><br/>\n<strong>ME:</strong> Where can I find him?<br/><br/> \n<strong>BUD:</strong> He&#39;s usually in THE PLACE. It&#39;s through the dressing rooms, but you don&#39;t want to go through this one.<br/><br/>\n<strong>ME:</strong> Right.<br/><br/>\n<strong>BUD:</strong> It isn&#39;t pretty...well, actually, it is pretty. Still..<br/><br/>\n<strong>ME:</strong> I&#39;ll go through the other one.<br/><br/>\n<strong>BUD:</strong> I get that. Be cool.\n</td>\n<td><img src=\"resources/bud.svg\"/></td>\n</tr></table>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue3\" role=\"link\" tabindex=\"0\">Go through the other dressing room.</a></p>",
		'passages': {
		},
	},
	'_continue3': {
		'clear': true,
		'text': "<p><em>Scene: The ladies&#39; dressing room.</em></p>\n<table><tr>\n<td><img src=\"resources/nique.svg\"/></td>\n<td>\n<strong>NIQUE:</strong> <em>(Emerging from behind a locker and pointing to the bell bottoms.)</em> <em>Bonjour</em>! I love zoze <em>fond de cloche</em>.<br/><br/>\n<strong>ME:</strong> Thanks. I like your outfit too. What kind of material is that?<br/><br/>\n<strong>NIQUE:</strong> <em>Je n&#39;ai aucune idée.</em> Some synthetic maybe?<br/><br/>\n<strong>ME:</strong> I&#39;m going to see THE GUY. I understand he&#39;s in THE PLACE, back this way?<br/><br/>\n<strong>NIQUE:</strong> Ooh, <em>LE LIEU</em>. Is big <em>secret</em>. He let no one in. You must knock loudly, <em>vraiment fort</em>!<br/><br/>\n<strong>ME:</strong> OK. Thanks for the tip.<br/><br/>\n<strong>NIQUE:</strong> Good luck, <em>mon cher</em>. \n</td></tr></table>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue4\" role=\"link\" tabindex=\"0\">Go to THE PLACE</a></p>",
		'passages': {
		},
	},
	'_continue4': {
		'clear': true,
		'text': "<p><em>Scene: Outside THE PLACE. The door is closed. Machinery noise emerges.</em></p>\n<p>Wow! I&#39;ve been knocking for five minutes. Maybe he can&#39;t hear me. It&#39;s really noisy in there. It seems impolite to <a class=\"squiffy-link link-passage\" data-passage=\"knock louder\" role=\"link\" tabindex=\"0\">knock louder</a> but maybe I should. Or maybe I should <a class=\"squiffy-link link-section\" data-section=\"try something else\" role=\"link\" tabindex=\"0\">try something else</a>. What though?</p>",
		'passages': {
			'knock louder': {
				'text': "<p>Ouch! My knuckles are sore. I&#39;ll either have to <a class=\"squiffy-link link-section\" data-section=\"try something else\" role=\"link\" tabindex=\"0\">try something else</a> or start <a class=\"squiffy-link link-passage\" data-passage=\"kicking the door\" role=\"link\" tabindex=\"0\">kicking the door</a>. What should I do?</p>",
			},
			'kicking the door': {
				'text': "<p>He still can&#39;t hear me. Maybe he&#39;s not even in there. I&#39;ll have to <a class=\"squiffy-link link-section\" data-section=\"try something else\" role=\"link\" tabindex=\"0\">try something else</a>.</p>",
			},
		},
	},
	'try something else': {
		'text': "<p>I don&#39;t know what to do. Should I <a class=\"squiffy-link link-section\" data-section=\"look around\" role=\"link\" tabindex=\"0\">look around</a> or just <a class=\"squiffy-link link-section\" data-section=\"give up\" role=\"link\" tabindex=\"0\">give up</a>?</p>",
		'passages': {
		},
	},
	'give up': {
		'text': "<p>Shoot! I&#39;ve tripped over the door mat. Wait! There&#39;s key under it! Now I can use the key to <a class=\"squiffy-link link-section\" data-section=\"unlock the door\" role=\"link\" tabindex=\"0\">unlock the door</a>.</p>",
		'passages': {
		},
	},
	'look around': {
		'text': "<p>All I can see is a door mat. Wait! People sometimes leave keys under doormats. </p>\n<p>Sure enough! Here&#39;s a key! I can use it to <a class=\"squiffy-link link-section\" data-section=\"unlock the door\" role=\"link\" tabindex=\"0\">get in THE PLACE</a>. What luck!</p>",
		'passages': {
		},
	},
	'unlock the door': {
		'clear': true,
		'text': "<p><em>Scene: THE PLACE. THE GUY is inside wearing noise-cancelling earphones. He takes them off. He looks surprised.</em></p>\n<table><tr>\n<td>\n<strong>THE GUY:</strong> Hey! Fashion models aren&#39;t supposed to see what&#39;s in here!<br/><br/>\n<strong>ME:</strong> I&#39;m not a fashion model! I&#39;m here by mistake. I need a ride.<br/><br/>\n<strong>THE GUY:</strong> You&#39;re not a fashion model? What about the bell bottoms?<br/><br/>\n<strong>ME:</strong> The bell bottoms are another mistake! Listen, I just need a ride back to Middle School. I won&#39;t tell anyone what you&#39;re doing in here. What <em>are</em> you doing in here anyway?<br/><br/>\n<strong>THE GUY:</strong> This is where I create my fashions.<br/><br/>\n<strong>ME:</strong> The machines look like 3D printers.<br/><br/>\n<strong>THE GUY:</strong> Yup. That&#39;s how I do it. I download the latest fashions from New York and 3D print them. You say you just need a ride?<br/><br/>\n<strong>ME:</strong> That&#39;s all.<br/><br/>\n<strong>THE GUY:</strong> As it happens, I&#39;ve just 3D printed a folding bicycle. Will that do?<br/><br/>\n<strong>ME:</strong> Sure. It&#39;s the best offer I&#39;ve had today.<br/><br/>\n<strong>THE GUY:</strong> When you get back, just fold up the bike and stick it in an envelope. Mail it to this address.<br/><br/>\n<strong>ME:</strong> Carrotsville?<br/><br/>\n<strong>THE GUY:</strong> Yeah. They used to grow a lot of carrots here. There&#39;s no money in it any more.<br/><br/>\n<strong>ME:</strong> Thanks so much for your help.<br/><br/>\n<strong>THE GUY:</strong> You&#39;re welcome. And, since you know my secret, if you ever want to become a fashion designer you know where to find me.\n</td>\n<td><img src=\"resources/theguy.svg\"/></td>\n</tr></table>\n\n<p><a class=\"squiffy-link link-section\" data-section=\"Epilogue\" role=\"link\" tabindex=\"0\">Epilogue</a></p>",
		'passages': {
		},
	},
	'Epilogue': {
		'clear': true,
		'text': "<p>It was no problem to ride the bike back to Middle School. I was late, but as luck would have it there had been a fire drill as soon as everyone got to class and they were still outside. I folded up the bike and stuck it in my pocket. No one ever knew I was late. Except you. Don&#39;t tell.</p>\n<center><h2>THE END</h2></center>",
		'passages': {
		},
	},
}
})();