import { JSX } from "solid-js/jsx-runtime";

export function Button(props: {
    onClick: () => void,
    children: JSX.Element,
    active?: undefined | boolean,
  }): JSX.Element {
      return <button
        class={""
          + "px-2 first:rounded-l-md last:rounded-r-md mr-1 last:mr-0 "
          + (props.active ? "bg-gray-500 " : "bg-gray-700 ")
        }
        onClick={props.onClick}
      >{props.children}</button>;
  }