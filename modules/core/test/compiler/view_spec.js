import {describe, xit, it, expect, beforeEach, ddescribe, iit} from 'test_lib/test_lib';
import {ProtoView, ElementPropertyMemento, DirectivePropertyMemento} from 'core/compiler/view';
import {ProtoElementInjector, ElementInjector} from 'core/compiler/element_injector';
import {DirectiveMetadataReader} from 'core/compiler/directive_metadata_reader';
import {Component, Decorator, Template} from 'core/annotations/annotations';
import {ProtoRecordRange} from 'change_detection/record_range';
import {ChangeDetector} from 'change_detection/change_detector';
import {TemplateConfig} from 'core/annotations/template_config';
import {Parser} from 'change_detection/parser/parser';
import {Lexer} from 'change_detection/parser/lexer';
import {DOM, Element} from 'facade/dom';
import {FIELD} from 'facade/lang';
import {Injector} from 'di/di';
import {View} from 'core/compiler/view';
import {ViewPort} from 'core/compiler/viewport';
import {reflector} from 'reflection/reflection';

export function main() {
  describe('view', function() {
    var parser, someComponentDirective, someTemplateDirective;

    beforeEach(() => {
      parser = new Parser(new Lexer());
      someComponentDirective = new DirectiveMetadataReader().annotatedType(SomeComponent);
      someTemplateDirective = new DirectiveMetadataReader().annotatedType(SomeTemplate);
    });


    describe('ProtoView.instantiate', function() {

      function createCollectDomNodesTestCases(useTemplateElement:boolean) {

        function templateAwareCreateElement(html) {
          return createElement(useTemplateElement ? `<template>${html}</template>` : html);
        }

        it('should collect the root node in the ProtoView element', () => {
          var pv = new ProtoView(templateAwareCreateElement('<div id="1"></div>'), new ProtoRecordRange());
          var view = pv.instantiate(null, null, null);
          expect(view.nodes.length).toBe(1);
          expect(view.nodes[0].getAttribute('id')).toEqual('1');
        });

        describe('collect elements with property bindings', () => {

          it('should collect property bindings on the root element if it has the ng-binding class', () => {
            var pv = new ProtoView(templateAwareCreateElement('<div [prop]="a" class="ng-binding"></div>'), new ProtoRecordRange());
            pv.bindElement(null);
            pv.bindElementProperty('prop', parser.parseBinding('a').ast);

            var view = pv.instantiate(null, null, null);
            expect(view.bindElements.length).toEqual(1);
            expect(view.bindElements[0]).toBe(view.nodes[0]);
          });

          it('should collect property bindings on child elements with ng-binding class', () => {
            var pv = new ProtoView(templateAwareCreateElement('<div><span></span><span class="ng-binding"></span></div>'),
              new ProtoRecordRange());
            pv.bindElement(null);
            pv.bindElementProperty('a', parser.parseBinding('b').ast);

            var view = pv.instantiate(null, null, null);
            expect(view.bindElements.length).toEqual(1);
            expect(view.bindElements[0]).toBe(view.nodes[0].childNodes[1]);
          });

        });

        describe('collect text nodes with bindings', () => {

          it('should collect text nodes under the root element', () => {
            var pv = new ProtoView(templateAwareCreateElement('<div class="ng-binding">{{}}<span></span>{{}}</div>'), new ProtoRecordRange());
            pv.bindElement(null);
            pv.bindTextNode(0, parser.parseBinding('a').ast);
            pv.bindTextNode(2, parser.parseBinding('b').ast);

            var view = pv.instantiate(null, null, null);
            expect(view.textNodes.length).toEqual(2);
            expect(view.textNodes[0]).toBe(view.nodes[0].childNodes[0]);
            expect(view.textNodes[1]).toBe(view.nodes[0].childNodes[2]);
          });

          it('should collect text nodes with bindings on child elements with ng-binding class', () => {
            var pv = new ProtoView(templateAwareCreateElement('<div><span> </span><span class="ng-binding">{{}}</span></div>'),
              new ProtoRecordRange());
            pv.bindElement(null);
            pv.bindTextNode(0, parser.parseBinding('b').ast);

            var view = pv.instantiate(null, null, null);
            expect(view.textNodes.length).toEqual(1);
            expect(view.textNodes[0]).toBe(view.nodes[0].childNodes[1].childNodes[0]);
          });

        });
      }

      describe('inplace instantiation', () => {
        it('should be supported.', () => {
          var template = createElement('<div></div>')
          var view = new ProtoView(template, new ProtoRecordRange())
              .instantiate(null, null, null, true);
          expect(view.nodes[0]).toBe(template);
        });

        it('should be off by default.', () => {
          var template = createElement('<div></div>')
          var view = new ProtoView(template, new ProtoRecordRange())
              .instantiate(null, null, null);
          expect(view.nodes[0]).not.toBe(template);
        });
      });

      describe('collect dom nodes with a regular element as root', () => {
        createCollectDomNodesTestCases(false);
      });

      describe('collect dom nodes with a template element as root', () => {
        createCollectDomNodesTestCases(true);
      });

      describe('create ElementInjectors', () => {
        it('should use the directives of the ProtoElementInjector', () => {
          var pv = new ProtoView(createElement('<div class="ng-binding"></div>'), new ProtoRecordRange());
          pv.bindElement(new ProtoElementInjector(null, 1, [SomeDirective]));

          var view = pv.instantiate(null, null, null);
          expect(view.elementInjectors.length).toBe(1);
          expect(view.elementInjectors[0].get(SomeDirective) instanceof SomeDirective).toBe(true);
        });

        it('should use the correct parent', () => {
          var pv = new ProtoView(createElement('<div class="ng-binding"><span class="ng-binding"></span></div>'),
            new ProtoRecordRange());
          var protoParent = new ProtoElementInjector(null, 0, [SomeDirective]);
          pv.bindElement(protoParent);
          pv.bindElement(new ProtoElementInjector(protoParent, 1, [AnotherDirective]));

          var view = pv.instantiate(null, null, null);
          expect(view.elementInjectors.length).toBe(2);
          expect(view.elementInjectors[0].get(SomeDirective) instanceof SomeDirective).toBe(true);
          expect(view.elementInjectors[1].parent).toBe(view.elementInjectors[0]);
        });
      });

      describe('collect root element injectors', () => {

        it('should collect a single root element injector', () => {
          var pv = new ProtoView(createElement('<div class="ng-binding"><span class="ng-binding"></span></div>'),
            new ProtoRecordRange());
          var protoParent = new ProtoElementInjector(null, 0, [SomeDirective]);
          pv.bindElement(protoParent);
          pv.bindElement(new ProtoElementInjector(protoParent, 1, [AnotherDirective]));

          var view = pv.instantiate(null, null, null);
          expect(view.rootElementInjectors.length).toBe(1);
          expect(view.rootElementInjectors[0].get(SomeDirective) instanceof SomeDirective).toBe(true);
        });

        it('should collect multiple root element injectors', () => {
          var pv = new ProtoView(createElement('<div><span class="ng-binding"></span><span class="ng-binding"></span></div>'),
            new ProtoRecordRange());
          pv.bindElement(new ProtoElementInjector(null, 1, [SomeDirective]));
          pv.bindElement(new ProtoElementInjector(null, 2, [AnotherDirective]));

          var view = pv.instantiate(null, null, null);
          expect(view.rootElementInjectors.length).toBe(2)
          expect(view.rootElementInjectors[0].get(SomeDirective) instanceof SomeDirective).toBe(true);
          expect(view.rootElementInjectors[1].get(AnotherDirective) instanceof AnotherDirective).toBe(true);
        });

      });

      describe('recurse over child component views', () => {
        var ctx;

        function createComponentWithSubPV(subProtoView) {
          var pv = new ProtoView(createElement('<cmp class="ng-binding"></cmp>'), new ProtoRecordRange());
          var binder = pv.bindElement(new ProtoElementInjector(null, 0, [SomeComponent], true));
          binder.componentDirective = someComponentDirective;
          binder.nestedProtoView = subProtoView;
          return pv;
        }

        function createNestedView(protoView) {
          ctx = new MyEvaluationContext();
          return protoView.instantiate(ctx, new Injector([]), null);
        }

        it('should create shadow dom', () => {
          var subpv = new ProtoView(createElement('<span>hello shadow dom</span>'), new ProtoRecordRange());
          var pv = createComponentWithSubPV(subpv);

          var view = createNestedView(pv);

          expect(view.nodes[0].shadowRoot.childNodes[0].childNodes[0].nodeValue).toEqual('hello shadow dom');
        });

        it('should expose component services to the component', () => {
          var subpv = new ProtoView(createElement('<span></span>'), new ProtoRecordRange());
          var pv = createComponentWithSubPV(subpv);

          var view = createNestedView(pv);

          var comp = view.rootElementInjectors[0].get(SomeComponent);
          expect(comp.service).toBeAnInstanceOf(SomeService);
        });

        it('should expose component services and component instance to directives in the shadow Dom',
            () => {
          var subpv = new ProtoView(
              createElement('<div dec class="ng-binding">hello shadow dom</div>'), new ProtoRecordRange());
          subpv.bindElement(
              new ProtoElementInjector(null, 0, [ServiceDependentDecorator]));
          var pv = createComponentWithSubPV(subpv);

          var view = createNestedView(pv);

          var subView = view.componentChildViews[0];
          var subInj = subView.rootElementInjectors[0];
          var subDecorator = subInj.get(ServiceDependentDecorator);
          var comp = view.rootElementInjectors[0].get(SomeComponent);

          expect(subDecorator).toBeAnInstanceOf(ServiceDependentDecorator);
          expect(subDecorator.service).toBe(comp.service);
          expect(subDecorator.component).toBe(comp);
        });
      });

      describe('recurse over child templateViews', () => {
        var ctx, view;
        function createView(protoView) {
          ctx = new MyEvaluationContext();
          view = protoView.instantiate(ctx, null, null);
        }

        it('should create a viewPort for the template directive', () => {
          var templateProtoView = new ProtoView(
              createElement('<div id="1"></div>'), new ProtoRecordRange());
          var pv = new ProtoView(createElement('<someTmpl class="ng-binding"></someTmpl>'), new ProtoRecordRange());
          var binder = pv.bindElement(new ProtoElementInjector(null, 0, [SomeTemplate]));
          binder.templateDirective = someTemplateDirective;
          binder.nestedProtoView = templateProtoView;

          createView(pv);

          var tmplComp = view.rootElementInjectors[0].get(SomeTemplate);
          expect(tmplComp.viewPort).not.toBe(null);
        });
      });

      describe('react to record changes', () => {
        var view, cd, ctx;

        function createView(protoView) {
          ctx = new MyEvaluationContext();
          view = protoView.instantiate(ctx, null, null);
          cd = new ChangeDetector(view.recordRange);
        }

        it('should consume text node changes', () => {
          var pv = new ProtoView(createElement('<div class="ng-binding">{{}}</div>'),
            new ProtoRecordRange());
          pv.bindElement(null);
          pv.bindTextNode(0, parser.parseBinding('foo').ast);
          createView(pv);

          ctx.foo = 'buz';
          cd.detectChanges();
          expect(view.textNodes[0].nodeValue).toEqual('buz');
        });

        it('should consume element binding changes', () => {
          var pv = new ProtoView(createElement('<div class="ng-binding"></div>'),
            new ProtoRecordRange());
          pv.bindElement(null);
          pv.bindElementProperty('id', parser.parseBinding('foo').ast);
          createView(pv);

          ctx.foo = 'buz';
          cd.detectChanges();
          expect(view.bindElements[0].id).toEqual('buz');
        });

        it('should consume directive watch expression change.', () => {
          var pv = new ProtoView(createElement('<div class="ng-binding"></div>'),
            new ProtoRecordRange());
          pv.bindElement(new ProtoElementInjector(null, 0, [SomeDirective]));
          pv.bindDirectiveProperty( 0, parser.parseBinding('foo').ast, 'prop', reflector.setter('prop'));
          createView(pv);

          ctx.foo = 'buz';
          cd.detectChanges();
          expect(view.elementInjectors[0].get(SomeDirective).prop).toEqual('buz');
        });
      });
    });

    describe('protoView createRootProtoView', () => {
      var el, pv;
      beforeEach(() => {
        el = DOM.createElement('div');
        pv = new ProtoView(createElement('<div>hi</div>'), new ProtoRecordRange());
      });

      it('should create the root component when instantiated', () => {
        var rootProtoView = ProtoView.createRootProtoView(pv, el, someComponentDirective);
        var view = rootProtoView.instantiate(null, new Injector([]), null, true);
        expect(view.rootElementInjectors[0].get(SomeComponent)).not.toBe(null);
      });

      it('should inject the protoView into the shadowDom', () => {
        var rootProtoView = ProtoView.createRootProtoView(pv, el, someComponentDirective);
        rootProtoView.instantiate(null, new Injector([]), null, true);
        expect(el.shadowRoot.childNodes[0].childNodes[0].nodeValue).toEqual('hi');
      });
    });
  });
}

class SomeDirective {
  prop;
  constructor() {
    this.prop = 'foo';
  }
}

class SomeService {}

@Component({
  componentServices: [SomeService]
})
class SomeComponent {
  service: SomeService;
  constructor(service: SomeService) {
    this.service = service;
  }
}

@Decorator({
  selector: '[dec]'
})
class ServiceDependentDecorator {
  component: SomeComponent;
  service: SomeService;
  constructor(component: SomeComponent, service: SomeService) {
    this.component = component;
    this.service = service;
  }
}

@Template({
  selector: 'someTmpl'
})
class SomeTemplate {
  viewPort: ViewPort;
  constructor(viewPort: ViewPort) {
    this.viewPort = viewPort;
  }
}


class AnotherDirective {
  prop:string;
  constructor() {
    this.prop = 'anotherFoo';
  }
}

class MyEvaluationContext {
  foo:string;
  constructor() {
    this.foo = 'bar';
  };
}

function createElement(html) {
  return DOM.createTemplate(html).content.firstChild;
}
