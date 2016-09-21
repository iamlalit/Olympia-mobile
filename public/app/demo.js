//
// Here is how to define your module
// has dependent on mobile-angular-ui
//
var app = angular.module('MobileAngularUiExamples', [
  'ngRoute',
  'mobile-angular-ui',

  // touch/drag feature: this is from 'mobile-angular-ui.gestures.js'
  // it is at a very beginning stage, so please be careful if you like to use
  // in production. This is intended to provide a flexible, integrated and and
  // easy to use alternative to other 3rd party libs like hammer.js, with the
  // final pourpose to integrate gestures into default ui interactions like
  // opening sidebars, turning switches on/off ..
  'mobile-angular-ui.gestures'
]);

app.run(function($transform, $anchorScroll) {
  window.$transform = $transform;
  $anchorScroll.yOffset = -50;   // always scroll by 50 extra pixels
});

//
// You can configure ngRoute as always, but to take advantage of SharedState location
// feature (i.e. close sidebar on backbutton) you should setup 'reloadOnSearch: false'
// in order to avoid unwanted routing.
//
app.config(function($routeProvider) {
  $routeProvider.when('/',              {templateUrl: 'forms.html', reloadOnSearch: false});
//  $routeProvider.when('/scroll',        {templateUrl: 'scroll.html', reloadOnSearch: false});
//  $routeProvider.when('/toggle',        {templateUrl: 'toggle.html', reloadOnSearch: false});
//  $routeProvider.when('/tabs',          {templateUrl: 'tabs.html', reloadOnSearch: false});
//  $routeProvider.when('/accordion',     {templateUrl: 'accordion.html', reloadOnSearch: false});
  $routeProvider.when('/overlay',       {templateUrl: 'overlay.html', reloadOnSearch: false});
//  $routeProvider.when('/forms',         {templateUrl: 'forms.html', reloadOnSearch: false});
//  $routeProvider.when('/dropdown',      {templateUrl: 'dropdown.html', reloadOnSearch: false});
//  $routeProvider.when('/touch',         {templateUrl: 'touch.html', reloadOnSearch: false});
//  $routeProvider.when('/swipe',         {templateUrl: 'swipe.html', reloadOnSearch: false});
//  $routeProvider.when('/drag',          {templateUrl: 'drag.html', reloadOnSearch: false});
//  $routeProvider.when('/drag2',         {templateUrl: 'drag2.html', reloadOnSearch: false});
//  $routeProvider.when('/carousel',      {templateUrl: 'carousel.html', reloadOnSearch: false});
//
  $routeProvider.when('/search',        {templateUrl: 'search.html', reloadOnSearch: false});
  $routeProvider.when('/job',           {templateUrl: 'job.html', reloadOnSearch: false});
  $routeProvider.when('/jobApply',           {templateUrl: 'jobApply.html', reloadOnSearch: false});
  $routeProvider.when('/jobs',           {templateUrl: 'jobs.html', reloadOnSearch: false});
  $routeProvider.when('/bevestiging',        {templateUrl: 'thankyouPage.html', reloadOnSearch: false});

});

//
// `$touch example`
//

app.directive('toucharea', ['$touch', function($touch){
  // Runs during compile
  return {
    restrict: 'C',
    link: function($scope, elem) {
      $scope.touch = null;
      $touch.bind(elem, {
        start: function(touch) {
          $scope.touch = touch;
          $scope.$apply();
        },

        cancel: function(touch) {
          $scope.touch = touch;
          $scope.$apply();
        },

        move: function(touch) {
          $scope.touch = touch;
          $scope.$apply();
        },

        end: function(touch) {
          $scope.touch = touch;
          $scope.$apply();
        }
      });
    }
  };
}]);

//
// `$drag` example: drag to dismiss
//
app.directive('dragToDismiss', function($drag, $parse, $timeout){
  return {
    restrict: 'A',
    compile: function(elem, attrs) {
      var dismissFn = $parse(attrs.dragToDismiss);
      return function(scope, elem){
        var dismiss = false;

        $drag.bind(elem, {
          transform: $drag.TRANSLATE_RIGHT,
          move: function(drag) {
            if( drag.distanceX >= drag.rect.width / 4) {
              dismiss = true;
              elem.addClass('dismiss');
            } else {
              dismiss = false;
              elem.removeClass('dismiss');
            }
          },
          cancel: function(){
            elem.removeClass('dismiss');
          },
          end: function(drag) {
            if (dismiss) {
              elem.addClass('dismitted');
              $timeout(function() {
                scope.$apply(function() {
                  dismissFn(scope);
                });
              }, 300);
            } else {
              drag.reset();
            }
          }
        });
      };
    }
  };
});

//
// Another `$drag` usage example: this is how you could create
// a touch enabled "deck of cards" carousel. See `carousel.html` for markup.
//
app.directive('carousel', function(){
  return {
    restrict: 'C',
    scope: {},
    controller: function() {
      this.itemCount = 0;
      this.activeItem = null;

      this.addItem = function(){
        var newId = this.itemCount++;
        this.activeItem = this.itemCount === 1 ? newId : this.activeItem;
        return newId;
      };

      this.next = function(){
        this.activeItem = this.activeItem || 0;
        this.activeItem = this.activeItem === this.itemCount - 1 ? 0 : this.activeItem + 1;
      };

      this.prev = function(){
        this.activeItem = this.activeItem || 0;
        this.activeItem = this.activeItem === 0 ? this.itemCount - 1 : this.activeItem - 1;
      };
    }
  };
});

app.directive('carouselItem', function($drag) {
  return {
    restrict: 'C',
    require: '^carousel',
    scope: {},
    transclude: true,
    template: '<div class="item"><div ng-transclude></div></div>',
    link: function(scope, elem, attrs, carousel) {
      scope.carousel = carousel;
      var id = carousel.addItem();

      var zIndex = function(){
        var res = 0;
        if (id === carousel.activeItem){
          res = 2000;
        } else if (carousel.activeItem < id) {
          res = 2000 - (id - carousel.activeItem);
        } else {
          res = 2000 - (carousel.itemCount - 1 - carousel.activeItem + id);
        }
        return res;
      };

      scope.$watch(function(){
        return carousel.activeItem;
      }, function(){
        elem[0].style.zIndex = zIndex();
      });

      $drag.bind(elem, {
        //
        // This is an example of custom transform function
        //
        transform: function(element, transform, touch) {
          //
          // use translate both as basis for the new transform:
          //
          var t = $drag.TRANSLATE_BOTH(element, transform, touch);

          //
          // Add rotation:
          //
          var Dx    = touch.distanceX,
              t0    = touch.startTransform,
              sign  = Dx < 0 ? -1 : 1,
              angle = sign * Math.min( ( Math.abs(Dx) / 700 ) * 30 , 30 );

          t.rotateZ = angle + (Math.round(t0.rotateZ));

          return t;
        },
        move: function(drag){
          if(Math.abs(drag.distanceX) >= drag.rect.width / 4) {
            elem.addClass('dismiss');
          } else {
            elem.removeClass('dismiss');
          }
        },
        cancel: function(){
          elem.removeClass('dismiss');
        },
        end: function(drag) {
          elem.removeClass('dismiss');
          if(Math.abs(drag.distanceX) >= drag.rect.width / 4) {
            scope.$apply(function() {
              carousel.next();
            });
          }
          drag.reset();
        }
      });
    }
  };
});

app.directive('dragMe', ['$drag', function($drag){
  return {
    controller: function($scope, $element) {
      $drag.bind($element,
        {
          //
          // Here you can see how to limit movement
          // to an element
          //
          transform: $drag.TRANSLATE_INSIDE($element.parent()),
          end: function(drag) {
            // go back to initial position
            drag.reset();
          }
        },
        { // release touch when movement is outside bounduaries
          sensitiveArea: $element.parent()
        }
      );
    }
  };
}]);

//
// For this trivial demo we have just a unique MainController
// for everything
//
app.controller('MainController', function($rootScope, $scope, $location, $anchorScroll, $filter, $timeout, $window, $interval){

  $scope.swiped = function(direction) {
    alert('Swiped ' + direction);
  };

  // User agent displayed in home page
  $scope.userAgent = navigator.userAgent;

  // Needed for the loading screen
  $rootScope.$on('$routeChangeStart', function(){
    $rootScope.loading = true;
  });

  $rootScope.$on('$routeChangeSuccess', function(){
    $rootScope.loading = false;
  });

  // Fake text i used here and there.
  $scope.lorem = 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Vel explicabo, aliquid eaque soluta nihil eligendi adipisci error, illum corrupti nam fuga omnis quod quaerat mollitia expedita impedit dolores ipsam. Obcaecati.';

  //
  // 'Scroll' screen
  //
  var scrollItems = [];

  for (var i=1; i<=100; i++) {
    scrollItems.push('Item ' + i);
  }

  $scope.scrollItems = scrollItems;
  $scope.currentPage = 0;
  $scope.pageSize = 10;
  $scope.data = [];
  $scope.q = '';
  var jobs = []
  $scope.jobs = [];
  for(var i = 1; i<=10; i++){
    jobs.push({
      jobTitle: 'Fulltime administratief medewerker bedrijfsbureau',
      jobDienstverband: 'Vast',
      jobLocatie: 'Groningen',
      jobAantal: '40',
      jobWerk: 'MBO werk- en denkniveau',
      jobDescription: 'Voor een relatie in Veenendaal zijn wij op zoek naar schoonmaakmedewerker voor 29 en 30 augustus. Werktijden:Maandag 15.30-20.30 uur Dinsdag 7.30-20.30 uur ivm uitbraak van een virus dient een ver...'
    });
    jobs.push({
      jobTitle: 'Heftruckchauffeur (m/v)',
      jobDienstverband: 'Avondwerk',
      jobLocatie: 'S-Gravenhage',
      jobAantal: '40',
      jobWerk: 'HBO werk- en denkniveau',
      jobDescription: 'Wij zijn op zoek naar servicegerichte medewerkers voor een project van Tele2 in Groningen. Het betreft een tijdelijke vacature vanaf 12 september voor de duur van 2 maanden. Tijdens deze gehele peri...'
    });
    jobs.push({
      jobTitle: 'Technisch commercieel medewerker',
      jobDienstverband: 'Vast',
      jobLocatie: 'Veldhoven',
      jobAantal: '20',
      jobWerk: 'HBO werk- en denkniveau',
      jobDescription: 'Voor onze opdrachtgever zijn wij op zoek naar een timmerman, welke op diverse (grotere) klussen (zelfstandig) aan de slag kan. Als timmerman verricht je onder andere de volgende werkzaamheden: * Best...'
    })
  }

  $scope.jobs = jobs;
  $scope.getData = function () {
      // needed for the pagination calc
      return $filter('filter')($scope.jobs, $scope.q)
  }

  $scope.numberOfPages=function(){
      return Math.ceil($scope.getData().length/$scope.pageSize);
  }

  //
  // Right Sidebar
  //
  $scope.chatUsers = [
    { name: 'Carlos  Flowers', online: true },
    { name: 'Byron Taylor', online: true },
    { name: 'Jana  Terry', online: true },
    { name: 'Darryl  Stone', online: true },
    { name: 'Fannie  Carlson', online: true },
    { name: 'Holly Nguyen', online: true },
    { name: 'Bill  Chavez', online: true },
    { name: 'Veronica  Maxwell', online: true },
    { name: 'Jessica Webster', online: true },
    { name: 'Jackie  Barton', online: true },
    { name: 'Crystal Drake', online: false },
    { name: 'Milton  Dean', online: false },
    { name: 'Joann Johnston', online: false },
    { name: 'Cora  Vaughn', online: false },
    { name: 'Nina  Briggs', online: false },
    { name: 'Casey Turner', online: false },
    { name: 'Jimmie  Wilson', online: false },
    { name: 'Nathaniel Steele', online: false },
    { name: 'Aubrey  Cole', online: false },
    { name: 'Donnie  Summers', online: false },
    { name: 'Kate  Myers', online: false },
    { name: 'Priscilla Hawkins', online: false },
    { name: 'Joe Barker', online: false },
    { name: 'Lee Norman', online: false },
    { name: 'Ebony Rice', online: false }
  ];

  $scope.dummyuser = [{
    email: "sander@test.nl",
    password: "sander"
  }];
  $scope.user = [];

  //
  // 'Forms' screen
  //
  $scope.rememberMe = true;
  $scope.email = 'me@example.com';

  $scope.go = function(path) {
//    alert('You submitted the login form');
    $location.path( '/' + path );
  };

  //
  // 'Drag' screen
  //
  $scope.notices = [];

  for (var j = 0; j < 10; j++) {
    $scope.notices.push({icon: 'envelope', message: 'Notice ' + (j + 1) });
  }

  $scope.deleteNotice = function(notice) {
    var index = $scope.notices.indexOf(notice);
    if (index > -1) {
      $scope.notices.splice(index, 1);
    }
  };
  //
  // Job apply form data
  //
  $scope.panels = [
    {
      panelHeadingTitle: "Inloggen",
      panelSubstituteHeading: "E-mail adres",
      isEditable: true,
      isActive: true,
      isDisabled: false,
      closed: false,
      isComplete: false
    },
    {
      panelHeadingTitle: "Persoonlijke gegevens",
      panelSubstituteHeading: "Persoonlijke gegevens",
      isEditable: true,
      isActive: false,
      isDisabled: true,
      closed: true,
      isComplete: false
    },
    {
      panelHeadingTitle: "CV & ervaring",
      panelSubstituteHeading: "CV & ervaring",
      isEditable: true,
      isActive: false,
      isDisabled: true,
      closed: true,
      isComplete: false
    },
    {
      panelHeadingTitle: "Samenvatting & motivatie",
      panelSubstituteHeading: "Samenvatting & motivatie",
      isEditable: true,
      isActive: false,
      isDisabled: true,
      closed: true,
      isComplete: false
    }
  ];
  //job apply form
  //cv write
  $scope.work = {
    "Functie": "",
    "bedrijf": "",
    "Vestigingsplaats": "",
    "Startdatummaand": "00",
    "Startdatumjaar": "0",
    "Einddatummaand": "00",
    "Einddatumjaar": "0",
    "FuntieBeschrijving": ""
  };

  $scope.user.cvWrite = [];
  $scope.addValuesForWork = function(object){
    if(object.Functie == '' || typeof object.Functie == "undefined"){
      $scope.user.showWorkForm = true;
    }else{
      $scope.user.showWorkForm = false;

      $scope.user.cvWrite.push({
        "Functie": object.Functie,
        "Bedrijf": object.Bedrijf,
        "Vestigingsplaats": object.Vestigingsplaats,
        "Startdatummaand": object.Startdatummaand,
        "Startdatumjaar": object.Startdatumjaar,
        "Einddatummaand": object.Einddatummaand,
        "Einddatumjaar": object.Einddatumjaar,
        "FuntieBeschrijving": object.FuntieBeschrijving
      });
      //cv write
      $scope.work = {
        "Functie": "",
        "Bedrijf": "",
        "Vestigingsplaats": "",
        "Startdatummaand": "00",
        "Startdatumjaar": "0",
        "Einddatummaand": "00",
        "Einddatumjaar": "0",
        "FuntieBeschrijving": ""
      };

    }
  }
  var globalWekIndexToEdit = 0;
  $scope.updateValuesForWork = function(object){
    if(object.Functie == '' || typeof object.Functie == "undefined"){
      $scope.user.showWorkForm = true;
    }else{
      $scope.user.cvWrite[globalWekIndexToEdit] = object;
      $scope.removeValueForWork();
      $scope.user.showWorkForm = false;
    }
  }
  $scope.editWerk = function(object, i){
    globalWekIndexToEdit = i;
    $scope.work = {
      "Functie": object.Functie,
      "Bedrijf": object.Bedrijf,
      "Vestigingsplaats": object.Vestigingsplaats,
      "Startdatummaand": object.Startdatummaand,
      "Startdatumjaar": object.Startdatumjaar,
      "Einddatummaand": object.Einddatummaand,
      "Einddatumjaar": object.Einddatumjaar,
      "FuntieBeschrijving": object.FuntieBeschrijving
    };
    $scope.showWorkForm = true;
  }
  $scope.removeValueForWork = function(){
    $scope.work = {
      "Functie": "",
      "Bedrijf": "",
      "Vestigingsplaats": "",
      "Startdatummaand": "00",
      "Startdatumjaar": "0",
      "Einddatummaand": "00",
      "Einddatumjaar": "0",
      "FuntieBeschrijving": ""
    };
  }

  $scope.deleteWerk = function(object, i){
    $scope.user.cvWrite.splice(i, 1);
  }

  //cv write experience
  $scope.experience = {
    "Opleiding": "",
    "Startdatummaand": "00",
    "Startdatumjaar": "0",
    "Einddatummaand": "00",
    "Einddatumjaar": "0",
    "diploma": "Ja"
  };

  $scope.user.cvWriteExp = [];
  $scope.addValuesForExp = function(object){
    if(object.Opleiding == '' || typeof object.Opleiding == "undefined"){
      $scope.user.showEducationForm = true;
    }else{
      $scope.user.cvWriteExp.push({
        "Opleiding": object.Opleiding,
        "Startdatummaand": object.Startdatummaand,
        "Startdatumjaar": object.Startdatumjaar,
        "Einddatummaand": object.Einddatummaand,
        "Einddatumjaar": object.Einddatumjaar,
        "diploma": object.diploma
      });
      //cv write
      $scope.experience = {
        "Opleiding": "",
        "Startdatummaand": "00",
        "Startdatumjaar": "0",
        "Einddatummaand": "00",
        "Einddatumjaar": "0",
        "diploma": "Ja"
      };

      $scope.user.showEducationForm = false;
    }
  }
  var globalExpIndexToEdit = 0;
  $scope.updateValuesForExp = function(object){
    if(object.Opleiding == '' || typeof object.Opleiding == "undefined"){
      $scope.user.showEducationForm = true;
    }else{
      $scope.user.cvWriteExp[globalExpIndexToEdit] = object;
      $scope.removeValueForExp();
      $scope.user.showEducationForm = false;
    }
  }
  $scope.editExp = function(object, i){
    globalExpIndexToEdit = i;
    $scope.experience = {
      "Opleiding": object.Opleiding,
      "Startdatummaand": object.Startdatummaand,
      "Startdatumjaar": object.Startdatumjaar,
      "Einddatummaand": object.Einddatummaand,
      "Einddatumjaar": object.Einddatumjaar,
      "diploma": object.diploma
    };
    $scope.showEducationForm = true;
  }
  $scope.removeValueForExp = function(){
    $scope.experience = {
      "Opleiding": "",
      "Startdatummaand": "00",
      "Startdatumjaar": "0",
      "Einddatummaand": "00",
      "Einddatumjaar": "0",
      "diploma": "Ja"
    };
  }

  $scope.deleteExp = function(object, i){
    $scope.user.cvWriteExp.splice(i, 1);
  }

  $scope.emailRegx = new RegExp('.+@.+\\..+');
  $scope.user.modalPopUpValue = false;
  $scope.previousUser = [{
    "userEmail": "patrick.v.d.polder@gmail.com",
    "password": "patrick123",
    "radioEmail": "option2",
    "scenarion": "inloggen",
    "terms": true,
    "firstname": "Patrick",
    "tussenvoegsel": "van de",
    "lastname": "Polder",
    "Gaslachet": "Man",
    "dobDay": "3",
    "dobMonth": "4",
    "dobYear": "30",
    "Mobielnummer": "0612345678",
    "Telefoonnummer": "0612345678",
    "Land": "Nederland",
    "Postcode": "6844 JH",
    "Huisnummer": "55",
    "Straat": "Beersdallaan",
    "Woonplaats": "Kralingen",
    "foto": "Patrick.jpg",
    "checkbox1": false,
    "checkbox2": false,
    "checkbox3": false,
    "checkbox4": false,
    "checkbox5": true,
    "checkbox6": false,
    "checkbox7": false,
    "checkbox8": false,
    "cvChoice": "cvUpload",
    "valueOfCV": "CV_Patrick.pdf",
    "cvWriteExp": [],
    "cvWrite": [],
    "opleidingsniveau": "Universitair",
    "SelectedOfficeDropDown": "117",
    "optionsRadios": "1",
    "showSecondPhoto": true
  },
  {
    "userEmail": "patrick.v.d.polder@live.com",
    "password": "patrick123",
    "radioEmail": "option2",
    "scenarion": "inloggen",
    "terms": true,
    "firstname": "Patrick",
    "tussenvoegsel": "van de",
    "lastname": "Polder",
    "Gaslachet": "Man",
    "dobDay": "3",
    "dobMonth": "4",
    "dobYear": "30",
    "Mobielnummer": "0612345678",
    "Telefoonnummer": "0612345678",
    "Land": "Nederland",
    "Postcode": "6844 JH",
    "Huisnummer": "55",
    "Straat": "Beersdallaan",
    "Woonplaats": "Kralingen",
    "foto": "Patrick.jpg",
    "checkbox1": false,
    "checkbox2": false,
    "checkbox3": false,
    "checkbox4": false,
    "checkbox5": true,
    "checkbox6": false,
    "checkbox7": false,
    "checkbox8": false,
    "cvChoice": "cvWrite",
    "valueOfCV": "",
    "cvWriteExp": [
      {
        "Opleiding": "VWO, Van Gastel college",
        "Startdatummaand": "08",
        "Startdatumjaar": "1991",
        "Einddatummaand": "06",
        "Einddatumjaar": "1998",
        "diploma": "Ja"
      },
      {
        "Opleiding": "Universiteit Amsterdam",
        "Startdatummaand": "08",
        "Startdatumjaar": "1998",
        "Einddatummaand": "07",
        "Einddatumjaar": "2014",
        "diploma": "Ja"
      }
    ],
    "cvWrite": [
      {
        "Functie": "Callcenter medewerker",
        "Bedrijf": "Menzis",
        "Vestigingsplaats": "Amsterdam",
        "Startdatummaand": "09",
        "Startdatumjaar": "1998",
        "Einddatummaand": "05",
        "Einddatumjaar": "2002",
        "FuntieBeschrijving": "Werken voor de klantenservice van zorgverzekeraar Menzis"
      },
      {
        "Functie": "Boukundig opzichter",
        "Bedrijf": "NEDAM",
        "Vestigingsplaats": "Haarlem",
        "Startdatummaand": "09",
        "Startdatumjaar": "2004",
        "Einddatummaand": "00",
        "Einddatumjaar": "0",
        "FuntieBeschrijving": ""
      }
    ],
    "opleidingsniveau": "Universitair",
    "SelectedOfficeDropDown": "117",
    "optionsRadios": "1",
    "showSecondPhoto": true
  }];

  $scope.getSrc = function(src){
    return "img/"+src;
  }

  $scope.invalidUser0 = false;
  $scope.invalidUser1 = false;
  $scope.saveValueOfModal = function(value){
    if(value){
        $scope.user.modalPopUpValue = value;
        $scope.userRegistrationStep1Submits(true,0);
    }else{
        $rootScope.Ui.turnOn('agemodalmessage');
    }
  }

  $scope.saveValueOfModalAgeMessage = function(value){
    if(value){
      $scope.go('');
    }
  }

  $scope.fotouploadimageFunction = function(value){
    if(value)
      $rootScope.Ui.turnOff('fotouploadimage');
  }

  $scope.userRegistrationStep1Submits = function(validityOfForm, i){
    $scope.buttonOfForm1CLicked = true;
    if($scope.user.radioEmail == 'option1'){
      console.log($scope.user);
      if(validityOfForm == true){
        $rootScope.Ui.turnOn('agemodal');
      }
      if(validityOfForm == true && $scope.user.modalPopUpValue){
        $scope.panels[i].isComplete = true;
        $scope.panels[i].isActive = false;
        $scope.panels[i].closed = true;
        $scope.openAndClosed(i+1, true);
      }
    }else if($scope.user.radioEmail == 'option2'){
      // make all steps comlete
      $scope.invalidUser0 = $scope.previousUser[0].password == $scope.user.password && $scope.previousUser[0].userEmail == $scope.user.userEmail;
      $scope.invalidUser1 = $scope.previousUser[1].password == $scope.user.password && $scope.previousUser[1].userEmail == $scope.user.userEmail;
      if(validityOfForm == true){
        if($scope.invalidUser0){
          $scope.previousUser[0].radioEmail = $scope.user.radioEmail;
          $scope.user = angular.copy($scope.previousUser[0]);

          toMoveToNextFunction(0);
          toMoveToNextFunction(1);
          toMoveToNextFunction(2);
        }else if($scope.invalidUser1){
          $scope.previousUser[1].radioEmail = $scope.user.radioEmail;
          $scope.user = angular.copy($scope.previousUser[1]);

          toMoveToNextFunction(0);
          toMoveToNextFunction(1);
          toMoveToNextFunction(2);
        }

      }
    }
  }

  $scope.moveToPreviousNode = function(i){
    toMoveToNextFunction(i);
  }

  function toMoveToNextFunction(i){
    $scope.panels[i].isComplete = true;
    $scope.panels[i].isActive = false;
    $scope.panels[i].closed = true;
    $scope.openAndClosed(i+1, true);
  }

  $scope.userRegistrationStep2Submits = function(validityOfForm, i, phoneParam){
    $scope.buttonOfForm2CLicked = true;
    if(validityOfForm == true ){
      console.log($scope.user);
      $scope.panels[i].isComplete = true;
      $scope.panels[i].isActive = false;
      $scope.panels[i].closed = true;
      $scope.openAndClosed(i+1, true);
    }
  }

  $scope.userRegistrationStep3Submits = function(validityOfForm, i){
    $scope.buttonOfForm3CLicked = true;
    if(validityOfForm == true){
      console.log($scope.user);
      $scope.panels[i].isComplete = true;
      $scope.panels[i].isActive = false;
      $scope.panels[i].closed = true;
      $scope.openAndClosed(i+1, true);
    }
  }

  $scope.userRegistrationStep4Submits = function(validityOfForm, i){
    $scope.buttonOfForm4CLicked = true;
    if(validityOfForm == true){
      console.log($scope.user);
      $scope.panels[i].isComplete = true;
      $scope.panels[i].isActive = false;
      $scope.panels[i].closed = true;
      $scope.go('bevestiging');
    }
  }

  //first close all tabs
  function closeAllTabs(){
    for(var i = 0; i< $scope.panels.length; i++){
      $scope.panels[i].isActive = false;
      $scope.panels[i].closed = true;
    }
  }

  $scope.openAndClosed = function(i, buttonCalling){

      if(buttonCalling == true){
        closeAllTabs();
        $scope.panels[i].isActive = true;
        $scope.panels[i].closed = false;
        $scope.panels[i].isDisabled = false;
        $scope.gotoAnchor('panel'+i);
      }else{
        if($scope.panels[i].isDisabled == false){
          angular.forEach($scope.panels, function(value, key) {
            value.isActive = false;
            value.closed = true;
          });
        if($scope.panels[i].isDisabled == false){
          $scope.panels[i].isActive = true;
          $scope.panels[i].closed = false;
          $scope.gotoAnchor('panel'+i);
        }
      }
    }
  }

  $scope.gotoAnchor = function(x) {
    $timeout(function() {
      var element = angular.element(document.getElementById(x));
      var location = 0;
      var scrollableContentController = element.controller('scrollableContent');
      location = document.getElementById(x).offsetTop;
      console.log(location);
      var windowLocation = document.documentElement.scrollTop || document.body.scrollTop;;
      newlocation = windowLocation;
      scrollableContentController.scrollTo(location, 10);
      // while(newlocation < location){
      //   newlocation = newlocation + 1;
      //   $interval(anchorScrolling(element, newlocation, scrollableContentController), 2);
      // }
    },10)


  };

  var anchorScrolling = function(element, location, scrollableContentController){
    $timeout(function() {
      scrollableContentController.scrollTo(location, 500);
      // console.log(location);
    },10)
  }

  $scope.focunOnInputElements = function(el){
    // $timeout(function() {
    //   var element = $window.document.getElementById(el);
    //   if(element)
    //     element.focus();
    // });
  }

  $scope.checkForGeen = function(){
    if($scope.user.checkbox8 == true){

    }
  }

  $scope.fileValueChange = function(){
    var value = angular.element(document.getElementById("file-input")).val();
    console.log(value);
    if(typeof value !== "undefined"){
      var value = value.replace('C:\\fakepath\\', '');
      $scope.$apply(function() {
          $scope.user.valueOfCV = value;
      });

      angular.element(document.getElementById("valueOfCV")).text(value);
      angular.element(document.getElementById("cvValueWell")).removeClass('hidden');
      angular.element(document.getElementById("deleteCV")).removeClass('hidden');
    }
  }

  $scope.deleteCV = function(){
    $scope.user.valueOfCV = '';
    angular.element(document.getElementById("file-input")).val('');
    angular.element(document.getElementById("valueOfCV")).text('');
    angular.element(document.getElementById("cvValueWell")).addClass('hidden');
    angular.element(document.getElementById("deleteCV")).addClass('hidden');
  }

  $scope.deleteCV();

  //dropbox
  var options = {

      // Required. Called when a user selects an item in the Chooser.
      success: function(files) {
          $scope.$apply(function() {
              $scope.user.valueOfCV = files[0].name;
          });
          angular.element(document.getElementById("valueOfCV")).text(files[0].name);
          angular.element(document.getElementById("cvValueWell")).removeClass('hidden');
          angular.element(document.getElementById("deleteCV")).removeClass('hidden');
      },

      // Optional. Called when the user closes the dialog without selecting a file
      // and does not include any parameters.
      cancel: function() {

      },

      // Optional. "preview" (default) is a preview link to the document for sharing,
      // "direct" is an expiring link to download the contents of the file. For more
      // information about link types, see Link types below.
      linkType: "direct", // or "direct"

      // Optional. A value of false (default) limits selection to a single file, while
      // true enables multiple file selection.
      multiselect: false, // or true

      // Optional. This is a list of file extensions. If specified, the user will
      // only be able to select files with these extensions. You may also specify
      // file types, such as "video" or "images" in the list. For more information,
      // see File types below. By default, all extensions are allowed.
      extensions: ['.pdf', '.doc', '.docx'],
  };
  $scope.dropboxButtonClick = function(){
    Dropbox.choose(options);
  }
  //dropbox ends
  //google drive starts
  // The Browser API key obtained from the Google Developers Console.
    // Replace with your own Browser API key, or your own key.
    var developerKey = 'AIzaSyDZ7FS13bhiLF09rOnPswudxsucMSGIG_Y';

    // The Client ID obtained from the Google Developers Console. Replace with your own Client ID.
    var clientId = "87021219866-v1eqmlc0vvlho02l22ohdpo1vpjnbpov.apps.googleusercontent.com"

    // Replace with your own App ID. (Its the first number in your Client ID)
    var appId = "87021219866";

    // Scope to use to access user's Drive items.
    var scope = ['https://www.googleapis.com/auth/drive'];

    var pickerApiLoaded = false;
    var oauthToken;

    // Use the Google API Loader script to load the google.picker script.
    function loadPicker() {
      gapi.load('auth', {'callback': onAuthApiLoad});
      gapi.load('picker', {'callback': onPickerApiLoad});
    }

    function onAuthApiLoad() {
      window.gapi.auth.authorize(
          {
            'client_id': clientId,
            'scope': scope,
            'immediate': false
          },
          handleAuthResult);
    }

    function onPickerApiLoad() {
      pickerApiLoaded = true;
      createPicker();
    }

    function handleAuthResult(authResult) {
      if (authResult && !authResult.error) {
        oauthToken = authResult.access_token;
        createPicker();
      }
    }

    // Create and render a Picker object for searching images.
    function createPicker() {
      if (pickerApiLoaded && oauthToken) {
        var view = new google.picker.View(google.picker.ViewId.DOCS);
        view.setMimeTypes("text/plain,text/html,application/rtf,application/vnd.oasis.opendocument.text,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        var picker = new google.picker.PickerBuilder()
            .enableFeature(google.picker.Feature.NAV_HIDDEN)
            .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
            .setAppId(appId)
            .setOAuthToken(oauthToken)
            .addView(view)
            .addView(new google.picker.DocsUploadView())
            .setLocale('nl')
            .setDeveloperKey(developerKey)
            .setCallback(pickerCallback)
            .build();
         picker.setVisible(true);
      }
    }

    // A simple callback implementation.
    function pickerCallback(data) {
      if (data.action == google.picker.Action.PICKED) {
        var fileName = data.docs[0].name;
        // alert('The user selected: ' + fileId);
        $scope.$apply(function() {
            $scope.user.valueOfCV = fileName;
        });
        angular.element(document.getElementById("valueOfCV")).text(fileName);
        angular.element(document.getElementById("cvValueWell")).removeClass('hidden');
        angular.element(document.getElementById("deleteCV")).removeClass('hidden');
      }
    }

    $scope.googleButtonClick = function(){
      loadPicker();
    }
  //google drive ends
  //one drive starts
  var odOptions = {
    clientId: "913aa826-40d7-4c0f-b0f0-b4feb82f513c",
    action: "download",
    multiSelect: false,
    openInNewWindow: true,
    advanced: {queryParameters: "select=id,name"},
    success: function(files) {
      $scope.$apply(function() {
          $scope.user.valueOfCV = files.value[0].name;
      });

      angular.element(document.getElementById("valueOfCV")).text(files.value[0].name);
      angular.element(document.getElementById("cvValueWell")).removeClass('hidden');
      angular.element(document.getElementById("deleteCV")).removeClass('hidden');
    },
    cancel: function() { /* cancel handler */ },
    error: function(e) { /* error handler */ }
  }
  function launchOneDrivePicker(){
    OneDrive.open(odOptions);
  }
  $scope.oneDriveButtonClick = function(){
    launchOneDrivePicker();
  }
  //one drive ends
});
//We already have a limitTo filter built-in to angular,
//let's make a startFrom filter
app.filter('startFrom', function() {
    return function(input, start) {
        start = +start; //parse to int
        return input.slice(start);
    }
});

/*
Accordion code
*/
// app.directive('toggleBody', function() {
//   return {
//     restrict: 'AE',
//     scope: {},
//     link: function(scope, elem, attrs) {
//       elem.on('click', function(){
//         if(!elem.hasClass('is-disabled') && !elem.hasClass('is-active')){
//           elem.toggleClass('closed');
//         }
//       })
//     }
//   }
// });

//scroll the user to the very first error message
app.directive('scrollToError', function() {
  return{
    restrict: 'AE',
    scope: {},
    link: function(scope, elem, attrs){
      elem.on('submit', function(){
        // find the first invalid element
        var firstInvalid = elem[0].querySelector('.validation-error');

        // if we find one, set focus
        if (firstInvalid) {
            firstInvalid.focus();
        }
      })
    }
  }
});

//anchor smooth scroll
app.service('anchorSmoothScroll', function(){

    this.scrollTo = function(eID) {
        var $elm = document.getElementById(eID);
        // angular.element("body").animate({scrollTop: $elm.offset().top}, "slow");
    };

});
