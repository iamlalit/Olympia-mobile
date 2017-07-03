'use-strict';

(function ($) {
 
    $.fn.validateForm = function(errorID) {
        
        var allInput = $(this).find(':input'),
			target = {},
			err = new Array;

		allInput.each(function (){
			target[this.type] = $(this).attr('id');
		});

		var obj = {target: target}

		var valid = [ 'checkbox', 'date', 'datetime', 'email', 'file', 'hidden', 'image', 'month', 'number', 'password', 'radio', 'range',
					 'reset', 'search', 'submit', 'tel', 'text', 'time', 'url', 'week' ];
		
		$.each(target, function(k, v){
			if ($.inArray(k, valid) != -1) {
				var valCheck = $('#'+v).attr('data-required');
				if(valCheck === 'true'){

					var
					errorMsgs = {
						email1 : 'E-mail address required',
						email2 : 'Not a valid e-mail address.',

						radio : 'Please select one radio option'
					},
					errorPlacement = {};

					switch(k){
						case 'email':
							
							var re = /^\s*[\w\-\+_]+(\.[\w\-\+_]+)*\@[\w\-\+_]+\.[\w\-\+_]+(\.[\w\-\+_]+)*\s*$/;
							var mail = jQuery.trim($('#'+v).val());

							if(mail == '' || mail == null){
								err.push(errorMsgs.email1);
								alert(errorMsgs.email1);
							} else if (!re.test(mail)) {
								err.push(errorMsgs.email2);
								alert(errorMsgs.email2);
							} else {
								return;
							}

							break;
						
						case 'text':
							alert('text found');
							break;
						
						case 'radio':
							var radioName = $('#'+v).attr('name');
							if($('input[name='+ radioName + ']:checked').length == 0){
								err.push(errorMsgs.radio);
								alert(errorMsgs.radio);
							}else{
								console.log($('input[name='+radioName+']:checked').val());
							}
							
							break;
						case 'checkbox':
							break;
						case '':
							break;
						case 'submit':
							break;
					}
					console.log(err)

					if($(document).find($(errorID))){
						$(document).find($(errorID)).html(err);
					}
				}
				else{
					return true;
				}
			}
		});
    };
 
}(jQuery));